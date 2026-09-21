# -*- coding: utf-8 -*-
"""为本地歌曲补齐封面图（提取内嵌封面 + iTunes 在线抓取）

用法：
    python manage.py fetch_covers                  # 全部本地歌（跳过演示曲）
    python manage.py fetch_covers --limit 5        # 只处理前 5 首（调试）
    python manage.py fetch_covers --dry-run        # 只预览不写库
    python manage.py fetch_covers --include-demo   # 连演示曲一起处理
    python manage.py fetch_covers --workers 8      # 并发数（默认 8）
    python manage.py fetch_covers --no-online      # 只提取内嵌封面，不联网

流程：优先提取 mp3/FLAC/m4a 文件内嵌封面（与歌曲 100% 匹配、无需网络）；
无内嵌封面时用 iTunes Search API 按「歌手 + 歌名」搜索下载高清封面（600x600）；
仍失败则保持为空（前端自动用生成的虚拟封面兜底，不影响任何功能）。

设计说明：
- 幂等：只处理 cover 为空的歌，可随时重跑
- 并发写库在主线程完成，避免 SQLite 并发写入问题
"""
import base64
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from music.models import Song

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"


def _extract_embedded(path):
    """从音频文件提取内嵌封面，返回 (图片字节, 扩展名)；无则 (None, None)"""
    try:
        from mutagen import File
        audio = File(str(path))
        if audio is None or audio.tags is None:
            return None, None
        tags = audio.tags
        # mp3（ID3 APIC 帧）
        apics = tags.getall("APIC") if hasattr(tags, "getall") else []
        if apics:
            apic = apics[0]
            ext = "jpg" if "jpeg" in (apic.mime or "") else "png"
            return bytes(apic.data), ext
        # m4a（covr）
        if "covr" in tags:
            return bytes(tags["covr"][0]), "jpg"
        # FLAC / OggVorbis（metadata_block_picture）
        if "metadata_block_picture" in tags:
            from mutagen.flac import Picture
            pic = Picture(base64.b64decode(tags["metadata_block_picture"][0]))
            ext = "jpg" if "jpeg" in (pic.mime or "") else "png"
            return bytes(pic.data), ext
    except Exception:
        pass
    return None, None


def _pick_item(results, title, artist):
    """在 iTunes 搜索结果里挑与目标歌最匹配的一项（歌手名命中加分）"""
    if not results:
        return None
    title, artist = (title or "").lower(), (artist or "").lower()
    best, best_score = results[0], -1.0
    for it in results:
        t = (it.get("trackName") or "").lower()
        a = (it.get("artistName") or "").lower()
        score = SequenceMatcher(None, t, title).ratio()
        if artist and a and artist in a:
            score += 0.25
        if score > best_score:
            best, best_score = it, score
    return best


def _fetch_online(title, artist):
    """iTunes 搜索并下载封面，返回 (图片字节, 扩展名)；失败返回 (None, None)"""
    term = f"{artist} {title}".strip()
    if not term:
        return None, None
    try:
        resp = requests.get(ITUNES_SEARCH_URL, params={
            "term": term, "media": "music", "entity": "musicTrack", "limit": 5,
        }, timeout=6)
        results = resp.json().get("results", [])
    except Exception:
        return None, None
    item = _pick_item(results, title, artist)
    if not item:
        return None, None
    url = (item.get("artworkUrl100") or "").replace("100x100", "600x600")
    if not url:
        return None, None
    try:
        img = requests.get(url, timeout=8)
        if img.status_code == 200 and img.content:
            ctype = img.headers.get("Content-Type", "")
            ext = "png" if "png" in ctype else "jpg"
            return img.content, ext
    except Exception:
        pass
    return None, None


def _process(song, online):
    """处理单首歌，返回 (song_id, title, artist, data, ext, flag)"""
    data, ext, flag = None, None, ""
    if song.file_path and Path(song.file_path).exists():
        data, ext = _extract_embedded(song.file_path)
        if data:
            flag = "embedded"
    if not data and online:
        data, ext = _fetch_online(song.title, song.artist)
        if data:
            flag = "itunes"
    return song.id, song.title, song.artist, data, ext, flag


class Command(BaseCommand):
    help = "为本地歌曲补齐封面：提取内嵌封面 + iTunes 在线抓取"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0,
                            help="只处理前 N 首（调试用），0 表示全部")
        parser.add_argument("--dry-run", action="store_true",
                            help="只预览结果，不写库")
        parser.add_argument("--include-demo", action="store_true",
                            help="连内置演示曲一起处理（默认跳过）")
        parser.add_argument("--workers", type=int, default=8,
                            help="并发数（默认 8）")
        parser.add_argument("--no-online", action="store_true",
                            help="只提取内嵌封面，不联网抓取")

    def handle(self, *args, **options):
        limit = options["limit"]
        dry_run = options["dry_run"]
        include_demo = options["include_demo"]
        workers = options["workers"]
        online = not options["no_online"]

        qs = Song.objects.filter(source="local").filter(cover="")
        if not include_demo:
            qs = qs.exclude(file_path__icontains="demo")
        todo = list(qs.order_by("id"))
        if limit:
            todo = todo[:limit]

        total = len(todo)
        self.stdout.write(f"待补封面: {total} 首（并发 {workers}，在线抓取={'开' if online else '关'}，dry_run={dry_run}）")
        if total == 0:
            self.stdout.write(self.style.SUCCESS("没有需要补封面的歌曲"))
            return

        results = []
        t0 = time.time()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {pool.submit(_process, s, online): s for s in todo}
            for i, fut in enumerate(as_completed(futs), 1):
                song_id, title, artist, data, ext, flag = fut.result()
                results.append((song_id, title, artist, data, ext, flag))
                self.stdout.write(f"[{i}/{total}] {title} - {artist} -> {flag or 'skip'}")

        # 写库（主线程串行，避免 SQLite 并发写）
        got = 0
        if not dry_run:
            for song_id, title, artist, data, ext, flag in results:
                if not data:
                    continue
                song = Song.objects.get(id=song_id)
                if song.cover.name:
                    song.cover.delete(save=False)  # 幂等：先清理旧文件
                song.cover.save(f"cover_{song_id}.{ext}", ContentFile(data), save=True)
                got += 1

        cost = int(time.time() - t0)
        embedded = sum(1 for r in results if r[5] == "embedded")
        itunes = sum(1 for r in results if r[5] == "itunes")
        missed = total - embedded - itunes  # 既无内嵌封面、在线也没搜到的歌
        self.stdout.write(self.style.SUCCESS(
            f"完成: 处理 {total} 首，内嵌封面 {embedded}，在线抓取 {itunes}，"
            f"写库 {got}，未命中 {missed}，耗时 {cost // 60}分{cost % 60}秒"
        ))
