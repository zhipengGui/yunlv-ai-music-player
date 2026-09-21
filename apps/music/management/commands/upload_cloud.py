# -*- coding: utf-8 -*-
"""将本地歌曲音频上传到对象存储，并把公网直链回填到 Song.cloud_url。

背景（方案一）：远程用户播放音频要走花生壳内网穿透隧道（约 1Mbps），
一首 8MB 的 MP3 要 1 分钟且多用户互相挤占。把音频传到对象存储后，
/api/music/stream/<id>/ 对已上云歌曲直接 302 到云端直链，
音频流量完全不经过隧道，远程听歌立即流畅。

用法：
    python manage.py upload_cloud                           # 使用 tools/cloud_config.json
    python manage.py upload_cloud --config <文件>            # 指定其他配置文件
    python manage.py upload_cloud --dry-run                 # 只预览待上传清单，不真正上传
    python manage.py upload_cloud --limit 5                 # 只处理前 5 首（调试）
    python manage.py upload_cloud --workers 3               # 并发上传数（默认 3，太大易打满上行带宽）

配置：
    复制 tools/cloud_config.example.json 为 tools/cloud_config.json 并填写密钥。
    支持三家：oss（阿里云）/ cos（腾讯云）/ qiniu（七牛云），provider 字段切换。
    未安装对应 SDK 时，脚本会给出 pip install 提示。

设计说明：
- 幂等：只处理 source=local 且 cloud_url 为空、文件仍存在的歌曲，可随时重跑
- key 规则：audio/<相对 music_library 的路径>，保留目录结构便于云端管理；
  文件不在曲库目录内时退化为 audio/<song_id>_<文件名>
- 回填的 cloud_url 已做 URL 编码（含中文/空格也可直接播放）
- 大文件（FLAC）走分片上传：OSS 用 resumable_upload（本地断点续传），
  COS 直接 PUT（单对象上限 5GB 足够），七牛用表单上传
- 本地文件始终保留，cloud_url 为空即回退本地播放
"""
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from music.models import Song

# 相对 music_library 的路径作为对象 key 的前缀
KEY_PREFIX = "audio"

CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
}

DEFAULT_CONFIG = Path(settings.BASE_DIR) / "tools" / "cloud_config.json"


def _load_config(path):
    """读取上传配置文件，返回 (provider, provider_cfg)"""
    if not Path(path).exists():
        raise CommandError(
            f"未找到配置文件：{path}\n"
            f"请复制 tools/cloud_config.example.json 为 tools/cloud_config.json，"
            f"填入对象存储密钥与域名后重试。"
        )
    try:
        cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as e:
        raise CommandError(f"配置文件解析失败：{e}")
    provider = (cfg.get("provider") or "").strip().lower()
    if provider not in ("oss", "cos", "qiniu"):
        raise CommandError("provider 必须是 oss（阿里云）/ cos（腾讯云）/ qiniu（七牛）之一")
    provider_cfg = cfg.get(provider) or {}
    missing = [k for k in ("public_domain",) if not provider_cfg.get(k)]
    if missing:
        raise CommandError(f"[{provider}] 缺少必需配置项：{', '.join(missing)}")
    return provider, provider_cfg


def _build_key(song, lib_dir):
    """由歌曲文件路径生成对象存储 key（audio/<相对路径>）"""
    try:
        rel = Path(song.file_path).resolve().relative_to(lib_dir)
    except ValueError:
        rel = None
    if rel is not None:
        key = "/".join(rel.parts)
    else:
        name = re.sub(r'[\\/:*?"<>|\s]+', "_", Path(song.file_path).stem)
        key = f"{song.id}_{name}{Path(song.file_path).suffix.lower()}"
    return f"{KEY_PREFIX}/{key}"


def _public_url(public_domain, key):
    """把 key 编码后拼成公网直链（中文/空格会被正确编码）"""
    return f"{public_domain.rstrip('/')}/{quote(key, safe='/')}"


def _upload_oss(file_path, key, ctype, cfg, store_root):
    """阿里云 OSS：直接 PUT（本项目最大文件约 60MB，远低于单对象 5GB 上限）。
    不使用 resumable_upload（multipart）——实测该分片方案在本环境频繁触发
    409 StaleUpload，直接 PUT 更简单可靠，失败可整首重试（脚本幂等）。
    """
    try:
        import oss2
    except ImportError:
        raise CommandError("缺少 oss2 库：pip install oss2")
    endpoint = cfg.get("endpoint") or "https://oss-cn-hangzhou.aliyuncs.com"
    if not endpoint.startswith("http"):
        endpoint = "https://" + endpoint
    auth = oss2.Auth(cfg["access_key_id"], cfg["access_key_secret"])
    bucket = oss2.Bucket(auth, endpoint, cfg["bucket"])
    bucket.put_object_from_file(
        key, file_path,
        headers={"Content-Type": ctype or "application/octet-stream"},
    )


def _upload_cos(file_path, key, ctype, cfg):
    """腾讯云 COS：直接 PUT（单对象上限 5GB，本项目最大文件远低于此）"""
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        raise CommandError("缺少 cos-python-sdk-v5 库：pip install cos-python-sdk-v5")
    config = CosConfig(
        Region=cfg["region"], SecretId=cfg["secret_id"],
        SecretKey=cfg["secret_key"], Scheme="https",
    )
    client = CosS3Client(config)
    size = os.path.getsize(file_path)
    with open(file_path, "rb") as fp:
        client.put_object(
            Bucket=cfg["bucket"], Key=key, Body=fp, ContentLength=size,
            ContentType=ctype or "application/octet-stream",
        )


def _upload_qiniu(file_path, key, ctype, cfg):
    """七牛云：表单上传（限 1GB 内文件，本项目适用）"""
    try:
        from qiniu import Auth, put_file
    except ImportError:
        raise CommandError("缺少 qiniu 库：pip install qiniu")
    auth = Auth(cfg["access_key"], cfg["secret_key"])
    token = auth.upload_token(cfg["bucket"], key)
    ret, info = put_file(token, key, file_path, mime_type=ctype or "application/octet-stream")
    if ret is None:
        raise RuntimeError(f"七牛上传失败：{info}")


def _upload_one(song, provider, provider_cfg, lib_dir, store_root):
    """上传单首歌，返回 cloud_url；上传失败抛异常"""
    file_path = Path(song.file_path)
    key = _build_key(song, lib_dir)
    ctype = CONTENT_TYPES.get(file_path.suffix.lower())
    if provider == "oss":
        _upload_oss(str(file_path), key, ctype, provider_cfg, store_root)
    elif provider == "cos":
        _upload_cos(str(file_path), key, ctype, provider_cfg)
    else:
        _upload_qiniu(str(file_path), key, ctype, provider_cfg)
    return _public_url(provider_cfg["public_domain"], key)


class Command(BaseCommand):
    help = "把本地歌曲音频上传到对象存储（OSS/COS/七牛）并回填 cloud_url"

    def add_arguments(self, parser):
        parser.add_argument("--config", default=str(DEFAULT_CONFIG),
                            help=f"配置文件路径（默认 {DEFAULT_CONFIG}）")
        parser.add_argument("--dry-run", action="store_true", help="只预览待上传清单，不上传")
        parser.add_argument("--limit", type=int, default=0, help="只处理前 N 首（0=全部）")
        parser.add_argument("--workers", type=int, default=3, help="并发上传数（默认 3）")

    def handle(self, *args, **options):
        config_path = options["config"]
        dry_run = options["dry_run"]
        limit = options["limit"]
        workers = max(1, options["workers"])

        provider, provider_cfg = _load_config(config_path)

        # 只处理：本地歌曲、尚未上云、文件仍存在
        lib_dir = Path(settings.MUSIC_LIBRARY_DIR).resolve()
        todo, missing_files = [], []
        for song in Song.objects.filter(source="local").filter(file_path__gt="").exclude(cloud_url__gt=""):
            p = Path(song.file_path)
            if not p.exists():
                missing_files.append(song)
                continue
            todo.append(song)
        todo.sort(key=lambda s: s.id)
        if limit:
            todo = todo[:limit]

        total = len(todo)
        self.stdout.write(
            f"[{provider}] 待上传 {total} 首（并发 {workers}，dry_run={dry_run}）"
        )
        if missing_files:
            self.stdout.write(self.style.WARNING(f"跳过文件缺失 {len(missing_files)} 首（不影响）"))
        if total == 0:
            self.stdout.write(self.style.SUCCESS("没有需要上传的歌曲"))
            return

        if dry_run:
            for i, s in enumerate(todo, 1):
                self.stdout.write(f"  [{i}/{total}] {_build_key(s, lib_dir)}")
            self.stdout.write(self.style.WARNING(f"dry-run 共 {total} 首，未执行上传"))
            return

        store_root = str(Path(settings.BASE_DIR) / "cache" / "upload_resume")
        ok, failed = [], []
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {
                pool.submit(_upload_one, s, provider, provider_cfg, lib_dir, store_root): s
                for s in todo
            }
            for i, fut in enumerate(as_completed(futs), 1):
                song = futs[fut]
                try:
                    url = fut.result()
                    ok.append((song, url))
                    self.stdout.write(f"[{i}/{total}] ✓ {song.title} - {song.artist}")
                except Exception as e:
                    failed.append((song, str(e)))
                    self.stdout.write(self.style.ERROR(
                        f"[{i}/{total}] ✗ {song.title} - {song.artist}：{e}"
                    ))

        # 写库（主线程串行，避免 SQLite 并发写）
        if ok:
            ids = [s.id for s, _ in ok]
            for song, url in ok:
                Song.objects.filter(id=song.id).update(cloud_url=url)
            self.stdout.write(self.style.SUCCESS(
                f"已回填 cloud_url {len(ok)} 首（id 区间 {min(ids)}~{max(ids)}）"
            ))
        cost = int(time.time() - t0)
        self.stdout.write(self.style.SUCCESS(
            f"完成：成功 {len(ok)}，失败 {len(failed)}，耗时 {cost // 60}分{cost % 60}秒"
        ))
        if failed:
            for song, err in failed[:10]:
                self.stdout.write(self.style.ERROR(f"  失败示例 {song.title}：{err}"))
