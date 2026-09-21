# -*- coding: utf-8 -*-
"""在线音频代理：上游安全拉取 + 磁盘缓存

职责：
1. 安全拉取上游音频 —— 手动跟随重定向并逐跳校验域名白名单（防 SSRF/重定向逃逸），
   且校验响应 Content-Type 必须为音频（防代理任意网页内容）
2. 磁盘缓存 —— key = sha1(上游 url)，TTL 12 小时
   - 命中缓存：直接本地读取（支持 Range，重复播放不再拉上游）
   - 未命中：全量流式下载，边写缓存边转发给客户端，完成后转正
   - 他人下载中：本次直连上游转发（不阻塞当前请求）
"""
import hashlib
import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests as _requests
from django.conf import settings
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse

# ---------- 白名单与常量 ----------
# 允许代理的在线音频源域名（白名单，防止被当作开放代理滥用）
PROXY_ALLOWED_HOSTS = (
    "itunes.apple.com",
    "mzstatic.com",
    "apple.com",
    "jamendo.com",
    "soundhelix.com",
)

UPSTREAM_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) YunLy/1.0"}
MAX_URL_LEN = 2048
MAX_REDIRECTS = 5
CACHE_TTL = 12 * 3600            # 在线流地址有时效（Jamendo 流约 24h），12 小时过期
MAX_CACHE_FILES = 400            # 缓存文件数量上限
CHUNK = 128 * 1024

CACHE_ROOT = Path(getattr(settings, "PROXY_CACHE_DIR", Path(settings.BASE_DIR) / "cache" / "proxy"))

# 并发下载锁：key -> threading.Lock（单进程 dev server 内有效）
_dl_locks = {}
_global_lock = threading.Lock()


def host_allowed(url):
    """URL 的域名是否在代理白名单内（含子域名）"""
    host = urlparse(url).netloc.lower()
    return any(host == h or host.endswith("." + h) for h in PROXY_ALLOWED_HOSTS)


def _cache_key(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


def _data_path(key):
    return CACHE_ROOT / f"{key}.dat"


def _meta_path(key):
    return CACHE_ROOT / f"{key}.json"


def _read_meta(key):
    """读取缓存元数据；过期/缺失返回 None（顺带清理）"""
    try:
        meta = json.loads(_meta_path(key).read_text(encoding="utf-8"))
    except Exception:
        return None
    if time.time() - meta.get("fetched_at", 0) > CACHE_TTL or not _data_path(key).exists():
        _delete(key)
        return None
    return meta


def _write_meta(key, content_type, size):
    meta = {"content_type": content_type, "size": size, "fetched_at": time.time()}
    try:
        _meta_path(key).write_text(json.dumps(meta), encoding="utf-8")
    except OSError:
        pass


def _delete(key):
    for p in (_data_path(key), _meta_path(key)):
        try:
            p.unlink()
        except OSError:
            pass


def _cleanup():
    """清理过期缓存与超量文件（最旧优先）"""
    try:
        now = time.time()
        for j in CACHE_ROOT.glob("*.json"):
            try:
                m = json.loads(j.read_text(encoding="utf-8"))
            except Exception:
                j.unlink(missing_ok=True)
                continue
            if now - m.get("fetched_at", 0) > CACHE_TTL:
                _delete(j.stem)
        jsons = sorted(CACHE_ROOT.glob("*.json"), key=lambda p: p.stat().st_mtime)
        while len(jsons) > MAX_CACHE_FILES:
            _delete(jsons[0].stem)
            jsons = jsons[1:]
    except Exception:
        pass


def _try_lock(key):
    """抢占某 key 的下载权；返回 True 表示由本请求负责下载"""
    with _global_lock:
        lk = _dl_locks.get(key)
        if lk and lk.locked():
            return False
        if lk is None:
            lk = threading.Lock()
            _dl_locks[key] = lk
        lk.acquire()
        return True


def _release_lock(key):
    with _global_lock:
        lk = _dl_locks.get(key)
    if lk and lk.locked():
        lk.release()


def _normalize_ctype(ctype):
    ctype = (ctype or "").split(";")[0].strip().lower()
    if ctype in ("audio/mpeg", "audio/mp3", "audio/mpga"):
        return "audio/mpeg"
    if ctype in ("audio/x-m4p", "audio/mp4", "video/mp4", "application/octet-stream", ""):
        return "audio/mp4"
    return ctype


def _is_audio(ctype):
    return ctype.startswith("audio/") or ctype in ("video/mp4", "application/octet-stream")


def open_upstream(url):
    """安全打开上游音频流：手动跟随重定向并逐跳校验白名单，返回 stream 响应或 None"""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        try:
            resp = _requests.get(current, headers=UPSTREAM_HEADERS, stream=True,
                                 timeout=20, allow_redirects=False)
        except Exception:
            return None
        if resp.status_code in (301, 302, 303, 307, 308):
            loc = resp.headers.get("Location")
            resp.close()
            if not loc:
                return None
            current = urljoin(current, loc)
            if not current.lower().startswith(("http://", "https://")):
                return None
            if not host_allowed(current):
                return None
            continue
        return resp
    return None


def handle(request, raw_url):
    """代理入口：
    1. 命中缓存 -> 本地读取（Range 支持）
    2. 未命中且拿到下载权 -> 全量下载并边写边转
    3. 未命中且他人下载中 -> 直连上游转发（不阻塞）
    """
    key = _cache_key(raw_url)

    meta = _read_meta(key)
    if meta:
        return _serve_cached(request, key, meta)

    if _try_lock(key):
        return _stream_and_cache(request, raw_url, key)

    return _proxy_pass(request, raw_url)


def _serve_cached(request, key, meta):
    """从磁盘缓存读取（支持 Range 请求，实现进度拖拽/快进快退）"""
    path = _data_path(key)
    size = path.stat().st_size
    range_header = request.headers.get("Range", "")
    start, end = 0, size - 1
    status = 200
    if range_header:
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if m:
            status = 206
            start = int(m.group(1)) if m.group(1) else 0
            end = int(m.group(2)) if m.group(2) else size - 1
            end = min(end, size - 1)
            if start >= size or start > end:
                return HttpResponse(status=416, content_type="text/plain")

    def file_iterator():
        with open(path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    resp = StreamingHttpResponse(file_iterator(), status=status,
                                 content_type=meta.get("content_type", "audio/mpeg"))
    resp["Content-Length"] = str(end - start + 1)
    resp["Content-Range"] = f"bytes {start}-{end}/{size}"
    resp["Accept-Ranges"] = "bytes"
    resp["Cache-Control"] = "no-cache"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp


def _stream_and_cache(request, raw_url, key):
    """全量流式下载：边写缓存文件边转发给客户端；完成后转正"""
    up = open_upstream(raw_url)
    if up is None:
        _release_lock(key)
        return JsonResponse({"error": "上游音频源连接失败"}, status=502)
    if up.status_code == 404:
        up.close()
        _release_lock(key)
        return JsonResponse({"error": "音频不存在（可能已下架）"}, status=404)
    if up.status_code in (401, 403):
        up.close()
        _release_lock(key)
        return JsonResponse({"error": "音频源拒绝访问"}, status=502)

    ctype = _normalize_ctype(up.headers.get("Content-Type", ""))
    if not _is_audio(ctype):
        up.close()
        _release_lock(key)
        return JsonResponse({"error": "上游返回的内容不是音频"}, status=502)

    try:
        CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    except OSError:
        _release_lock(key)
        return JsonResponse({"error": "缓存目录不可写"}, status=500)

    tmp_path = CACHE_ROOT / f"{key}.tmp"
    final_path = _data_path(key)
    f = open(tmp_path, "wb")
    done = False

    def gen():
        nonlocal done
        try:
            for chunk in up.iter_content(chunk_size=CHUNK):
                if chunk:
                    f.write(chunk)
                    yield chunk
            done = True
        finally:
            up.close()
            f.close()
            try:
                if done and tmp_path.exists() and tmp_path.stat().st_size > 0:
                    size = tmp_path.stat().st_size
                    tmp_path.rename(final_path)
                    _write_meta(key, ctype, size)
                    _cleanup()
                else:
                    tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            _release_lock(key)

    resp = StreamingHttpResponse(gen(), status=200, content_type=ctype)
    resp["Cache-Control"] = "no-cache"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp


def _proxy_pass(request, raw_url):
    """直连上游转发（不缓存），用于他人正在下载同一 URL 的场景"""
    up = open_upstream(raw_url)
    if up is None:
        return JsonResponse({"error": "上游音频源连接失败"}, status=502)

    ctype = _normalize_ctype(up.headers.get("Content-Type", ""))
    if not _is_audio(ctype):
        up.close()
        return JsonResponse({"error": "上游返回的内容不是音频"}, status=502)

    range_header = request.headers.get("Range", "")
    if range_header and not up.headers.get("Content-Range"):
        # 未命中缓存时 Range 请求直接透传上游结果
        pass

    def gen():
        try:
            for chunk in up.iter_content(chunk_size=CHUNK):
                if chunk:
                    yield chunk
        finally:
            up.close()

    resp = StreamingHttpResponse(gen(), status=up.status_code, content_type=ctype)
    for h in ("Content-Length", "Content-Range", "Accept-Ranges"):
        if up.headers.get(h):
            resp[h] = up.headers[h]
    resp["Cache-Control"] = "no-cache"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp
