# -*- coding: utf-8 -*-
"""板块1 API：音乐核心
- 歌曲列表 / 详情 / 搜索（多源合并）
- 音频流（支持 Range 请求，实现进度拖拽）
- 曲库扫描 / 播放记录 / 标签词表
"""
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

from django.http import HttpResponse, HttpResponseRedirect, JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .models import GENRE_CHOICES, MOOD_TAG_CHOICES, ListenRecord, Song
from .scanner import scan_library
from .sources import SOURCES, available_sources


def song_list(request):
    """歌曲列表（支持 genre / tag / source 过滤）"""
    qs = Song.objects.all()
    genre = request.GET.get("genre")
    tag = request.GET.get("tag")
    source = request.GET.get("source")
    if genre:
        qs = qs.filter(genre=genre)
    if tag:
        qs = qs.filter(tags__icontains=tag)
    if source:
        qs = qs.filter(source=source)
    qs = qs[:200]
    return JsonResponse({"songs": [s.to_dict() for s in qs]})


def song_detail(request, song_id):
    song = get_object_or_404(Song, id=song_id)
    return JsonResponse(song.to_dict())


def search(request):
    """多源搜索：本地曲库 + 在线曲库 结果合并返回（各源并行请求，单个源超时不影响整体）"""
    q = request.GET.get("q", "").strip()
    sources = [s for s in request.GET.get("sources", "local,jamendo,soundhelix,online").split(",") if s]
    limit = min(int(request.GET.get("limit", 20)), 50)

    def _search_one(name):
        src = SOURCES.get(name)
        if not src:
            return []
        try:
            return src.search(q, limit=limit)
        except Exception:
            return []

    # 并行搜索所有源，总耗时 = 最慢单个源
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_search_one, name): name for name in sources}
        found = {name: fut.result() for fut, name in futures.items()}

    results = []
    for name in sources:
        src = SOURCES.get(name)
        if not src:
            continue
        for item in found.get(name, []):
            if isinstance(item, dict):
                # 在线源：补充 stream_url 后直接返回（统一走站内代理，
                # 否则跨域音频在浏览器端被 Web Audio 频谱强制静音）
                raw = src.get_stream_url(_LightSong(item))
                item = {**item, "stream_url": _proxied_stream_url(raw)}
                results.append(item)
            else:
                d = item.to_dict()
                d["stream_url"] = _proxied_stream_url(src.get_stream_url(item))
                results.append(d)
    return JsonResponse({"query": q, "count": len(results), "songs": results})


def stream(request, song_id):
    """音频流：支持 Range 请求（进度拖拽 / 快进快退）"""
    song = get_object_or_404(Song, id=song_id)
    # 在线歌曲：直接 302 到源站
    if song.source == "online" and song.source_url:
        return HttpResponseRedirect(song.source_url)
    # 本地歌曲已上云：直接 302 到云端直链，音频流量不经过内网穿透隧道
    if song.cloud_url:
        return HttpResponseRedirect(song.cloud_url)

    path = Path(song.file_path)
    if not path.exists():
        return JsonResponse({"error": "音频文件不存在"}, status=404)

    file_size = path.stat().st_size
    range_header = request.headers.get("Range", "")
    m = re.match(r"bytes=(\d*)-(\d*)", range_header)
    start, end = 0, file_size - 1
    status = 200
    if m:
        status = 206
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else file_size - 1
        end = min(end, file_size - 1)
        if start >= file_size or start > end:
            return HttpResponse(status=416, content_type="text/plain")

    def file_iterator(f, offset, length):
        f.seek(offset)
        remaining = length
        try:
            while remaining > 0:
                chunk = f.read(min(128 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
        finally:
            f.close()

    ext = path.suffix.lower()
    content_type = {
        ".mp3": "audio/mpeg", ".flac": "audio/flac",
        ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    }.get(ext, "application/octet-stream")

    f = open(path, "rb")
    response = StreamingHttpResponse(
        file_iterator(f, start, end - start + 1),
        status=status,
        content_type=content_type,
    )
    response["Content-Length"] = str(end - start + 1)
    response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    response["Accept-Ranges"] = "bytes"
    response["Cache-Control"] = "no-cache"
    return response


def _proxied_stream_url(raw_url):
    """把在线音频地址包装成站内代理地址。

    浏览器对跨域音频执行 Web Audio（频谱可视化）时会强制静音
    （进度条正常但无声音），走站内代理后变为同源，声音与频谱都正常。
    """
    if not raw_url or not raw_url.lower().startswith(("http://", "https://")):
        return raw_url
    return f"/api/music/proxy/?url={quote(raw_url, safe='')}"


def proxy_audio(request):
    """在线音频代理：命中磁盘缓存则本地读取，否则安全拉取上游并缓存。

    支持 Range 请求（进度拖拽）；统一 Content-Type，
    解决 iTunes 试听 audio/x-m4p 部分浏览器无法识别的问题。
    """
    from . import proxy_cache

    raw = request.GET.get("url", "")
    if not raw.lower().startswith(("http://", "https://")):
        return JsonResponse({"error": "不支持的音频地址"}, status=400)
    if len(raw) > proxy_cache.MAX_URL_LEN:
        return JsonResponse({"error": "音频地址过长"}, status=400)
    if not proxy_cache.host_allowed(raw):
        return JsonResponse({"error": "该音频源不在允许的白名单内"}, status=403)
    return proxy_cache.handle(request, raw)


# ---- 扫描后自动打标的进度状态（进程内共享，单机运行够用） ----
_TAG_LOCK = threading.Lock()
_TAG_PROGRESS = {
    "running": False,
    "total": 0,
    "done": 0,
    "changed": 0,
    "failed": 0,
    "current": "",
    "started_at": None,
    "finished_at": None,
}


def _start_retag(ids):
    """后台线程启动对指定歌曲 id 列表的 AI 打标；已有任务在跑时不重复启动"""
    with _TAG_LOCK:
        if _TAG_PROGRESS["running"]:
            return False
        _TAG_PROGRESS.update(
            running=True, total=len(ids), done=0, changed=0, failed=0,
            current="", started_at=time.strftime("%H:%M:%S"), finished_at=None,
        )

    def _run():
        from .retagger import retag_songs_for

        def _cb(done, total, song, new_tags, new_genre, lyric_len):
            with _TAG_LOCK:
                _TAG_PROGRESS["done"] = done
                _TAG_PROGRESS["current"] = f"{song.title} - {song.artist}"

        try:
            res = retag_songs_for(ids, workers=2, progress_cb=_cb)
            with _TAG_LOCK:
                _TAG_PROGRESS.update(
                    done=res["processed"], changed=res["changed"], failed=res["failed"],
                )
        except Exception:
            with _TAG_LOCK:
                _TAG_PROGRESS["failed"] = _TAG_PROGRESS["total"]
        finally:
            with _TAG_LOCK:
                _TAG_PROGRESS["running"] = False
                _TAG_PROGRESS["finished_at"] = time.strftime("%H:%M:%S")
            from django.db import close_old_connections
            close_old_connections()

    threading.Thread(target=_run, daemon=True).start()
    return True


@csrf_exempt
def scan(request):
    """扫描本地音乐库入库（POST）；新增歌曲自动触发后台 AI 打标"""
    ids = scan_library()
    added = len(ids)
    tagging = False
    if ids:
        tagging = _start_retag(ids)
    return JsonResponse({
        "added": added,
        "total": Song.objects.count(),
        "tagging": tagging,
    })


def tag_progress(request):
    """自动打标进度（GET），供前端轮询展示"""
    with _TAG_LOCK:
        return JsonResponse(dict(_TAG_PROGRESS))


@csrf_exempt
def record_play(request, song_id):
    """记录播放（播放次数 + 听歌历史，供推荐系统使用）"""
    song = get_object_or_404(Song, id=song_id)
    duration = 0
    # 前端 api.js 以 JSON body 上报 {duration}，兼容历史 form 提交
    if request.content_type == "application/json":
        try:
            import json
            data = json.loads(request.body or b"{}")
            duration = float(data.get("duration") or 0)
        except Exception:
            duration = 0
    else:
        try:
            duration = float(request.POST.get("duration", 0) or 0)
        except Exception:
            duration = 0
    song.play_count += 1
    song.save(update_fields=["play_count"])
    ListenRecord.objects.create(song=song, duration_sec=duration)
    return JsonResponse({"ok": True, "play_count": song.play_count})


@csrf_exempt
def voice(request):
    """语音点歌：前端把识别文本 POST 过来，解析后返回可播放歌曲列表"""
    import json

    try:
        body = json.loads(request.body or b"{}")
        text = body.get("text", "")
    except Exception:
        text = request.POST.get("text", "")

    from .voice import parse_voice
    return JsonResponse(parse_voice(text))


def hot_songs(request):
    """热门歌曲：按播放次数排序"""
    qs = Song.objects.order_by("-play_count")[:20]
    return JsonResponse({"songs": [s.to_dict() for s in qs]})


def tag_list(request):
    """情绪标签 / 曲风 / 可用音乐源（供前端与情绪点歌台使用）"""
    return JsonResponse({
        "tags": [{"name": k, "label": v} for k, v in MOOD_TAG_CHOICES],
        "genres": [{"name": k, "label": v} for k, v in GENRE_CHOICES],
        "sources": available_sources(),
    })


class _LightSong:
    """在线源搜索结果轻量对象，仅用于取流地址"""

    def __init__(self, d):
        self.source_url = d.get("stream_url", "")
        self.source_id = d.get("source_id", "")
