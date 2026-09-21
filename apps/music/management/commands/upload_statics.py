# -*- coding: utf-8 -*-
"""把前端静态资源（static/ 与 media/）同步到对象存储（方案二）。

背景：远程用户打开播放器页面时，20+ 个 JS/CSS 与封面图都从自建服务器
走花生壳隧道下载，首次访问很慢。把静态资源上传到与音频同一个对象存储桶后，
页面里所有 JS/CSS/封面都由对象存储域名直接提供，远程首屏加载与切歌同速。

用法：
    python manage.py upload_statics                           # 同步 static/ + media/
    python manage.py upload_statics --dry-run                 # 只预览清单，不上传
    python manage.py upload_statics --force                   # media 也强制覆盖（默认跳过已存在对象）
    python manage.py upload_statics --only media              # 只同步 media/

设计说明：
- key 保留顶层目录：static/<相对路径>、media/<相对路径>，
  与模板 static_ver 输出的 URL（<public_domain>/static/...）一一对应
- static/ 文件每次全量覆盖上传（数量少、改动需立即上云）；
  media/ 封面默认跳过已存在对象（468 张图重复执行时秒过），--force 强制覆盖
- JS/CSS 等按扩展名设置正确 Content-Type（否则浏览器拒绝执行），
  并附带缓存头：static 文件版本化故长缓存（max-age=1年），media 短缓存（1小时）
- 幂等：重复执行安全；失败文件会单独列出，可整批重跑
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

# 依赖 upload_cloud 的配置读取规则（三家对象存储一致）
from music.management.commands.upload_cloud import _load_config

CACHE_STATIC = "public, max-age=31536000, immutable"  # static_ver 已带 ?v= 版本号
CACHE_MEDIA = "public, max-age=3600"

CONTENT_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
}


def _client(provider, cfg):
    """创建对象存储客户端（供 oss/cos；qiniu 走表单上传无需客户端）"""
    if provider == "oss":
        import oss2
        endpoint = cfg.get("endpoint") or "https://oss-cn-hangzhou.aliyuncs.com"
        if not endpoint.startswith("http"):
            endpoint = "https://" + endpoint
        auth = oss2.Auth(cfg["access_key_id"], cfg["access_key_secret"])
        return oss2.Bucket(auth, endpoint, cfg["bucket"])
    if provider == "cos":
        from qcloud_cos import CosConfig, CosS3Client
        config = CosConfig(
            Region=cfg["region"], SecretId=cfg["secret_id"],
            SecretKey=cfg["secret_key"], Scheme="https",
        )
        return CosS3Client(config)
    return None


def _exists(provider, client, key, cfg):
    """对象是否已存在（qiniu 跳过逻辑不支持，恒 False 表示始终上传）"""
    if provider == "oss":
        return bool(client.object_exists(key))
    if provider == "cos":
        return bool(client.object_exists(Bucket=cfg["bucket"], Key=key))
    return False


def _upload(provider, client, path, key, cfg):
    """上传单个文件并设置 Content-Type / Cache-Control"""
    ctype = CONTENT_TYPES.get(Path(path).suffix.lower())
    headers = {}
    if ctype:
        headers["Content-Type"] = ctype
    headers["Cache-Control"] = CACHE_MEDIA if key.startswith("media/") else CACHE_STATIC

    if provider == "oss":
        client.put_object_from_file(key, str(path), headers=headers)
    elif provider == "cos":
        with open(path, "rb") as fp:
            client.put_object(
                Bucket=cfg["bucket"], Key=key, Body=fp,
                ContentLength=Path(path).stat().st_size,
                ContentType=ctype or "application/octet-stream",
                CacheControl=headers["Cache-Control"],
            )
    else:  # qiniu：表单上传，仅支持 mime
        from qiniu import Auth, put_file
        auth = Auth(cfg["access_key"], cfg["secret_key"])
        token = auth.upload_token(cfg["bucket"], key)
        ret, info = put_file(token, key, str(path), mime_type=ctype or "application/octet-stream")
        if ret is None:
            raise RuntimeError(f"七牛上传失败：{info}")


class Command(BaseCommand):
    help = "同步前端静态资源（static/、media/）到对象存储（OSS/COS/七牛）"

    def add_arguments(self, parser):
        parser.add_argument("--config", default=str(Path(settings.BASE_DIR) / "tools" / "cloud_config.json"),
                            help="对象存储配置文件路径")
        parser.add_argument("--dry-run", action="store_true", help="只预览待上传清单，不上传")
        parser.add_argument("--force", action="store_true", help="media/ 已有对象也强制覆盖")
        parser.add_argument("--only", choices=["static", "media", "all"], default="all",
                            help="只同步 static/ 或 media/（默认全部）")
        parser.add_argument("--workers", type=int, default=4, help="并发上传数（默认 4）")

    def handle(self, *args, **options):
        provider, cfg = _load_config(options["config"])
        dry_run, force, only = options["dry_run"], options["force"], options["only"]
        workers = max(1, options["workers"])
        client = _client(provider, cfg)

        # 生成清单：(key, 文件路径)
        plan = []
        sources = []
        if only in ("static", "all"):
            sources.append(("static", Path(settings.BASE_DIR) / "static"))
        if only in ("media", "all"):
            sources.append(("media", Path(settings.MEDIA_ROOT)))
        for prefix, src in sources:
            if not src.exists():
                self.stderr.write(f"警告：目录不存在，跳过 {src}")
                continue
            for p in sorted(src.rglob("*")):
                if not p.is_file():
                    continue
                rel = p.relative_to(src)
                key = f"{prefix}/{'/'.join(rel.parts)}"
                plan.append((key, p))

        # 过滤已存在对象（仅 media/ 默认跳过）
        todo, skipped = [], 0
        for key, p in plan:
            if key.startswith("media/") and not force and _exists(provider, client, key, cfg):
                skipped += 1
                continue
            todo.append((key, p))
        todo.sort()

        self.stdout.write(
            f"[{provider}] 待上传 {len(todo)} 个文件（已存在跳过 {skipped}，dry_run={dry_run}）"
        )
        if dry_run:
            for key, _ in todo:
                self.stdout.write(f"  {key}")
            self.stdout.write(self.style.WARNING(f"dry-run 共 {len(todo)} 个文件，未执行上传"))
            return

        ok, failed = [], []
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {pool.submit(_upload, provider, client, p, key, cfg): (key, p)
                    for key, p in todo}
            for i, fut in enumerate(as_completed(futs), 1):
                key, _ = futs[fut]
                try:
                    fut.result()
                    ok.append(key)
                    self.stdout.write(f"[{i}/{len(todo)}] ✓ {key}")
                except Exception as e:
                    failed.append((key, str(e)))
                    self.stdout.write(self.style.ERROR(f"[{i}/{len(todo)}] ✗ {key}：{e}"))

        cost = int(time.time() - t0)
        self.stdout.write(self.style.SUCCESS(
            f"完成：成功 {len(ok)}，失败 {len(failed)}，耗时 {cost // 60}分{cost % 60}秒"
        ))
        if failed:
            for key, err in failed[:10]:
                self.stdout.write(self.style.ERROR(f"  失败示例 {key}：{err}"))
