# -*- coding: utf-8 -*-
"""歌曲情绪标签批量打标核心逻辑（retag_songs 命令 与 扫描后自动打标 共用）

流程：读本地 .lrc（无则在线抓歌词）→ 智谱 GLM 按歌词判定情绪 → 写回 tags
无歌词 / AI 失败时退回关键词规则兜底，保证每首歌都有合理标签。

并发打标时注意：
- 并发数不要太大，否则容易被歌词源（网易云）限流，默认 3
- 每首歌都会调用一次智谱 GLM（免费模型 glm-4-flash），增量打标只处理真正的新歌
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from lyrics.netease import fetch_lrc
from mood.ai_service import classify_song
from .models import Song


def _read_local_lyric(song):
    """优先读同目录 .lrc 文件，没有返回空串"""
    if not song.file_path:
        return ""
    try:
        p = Path(song.file_path).with_suffix(".lrc")
        if p.exists():
            return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        pass
    return ""


def _fetch_lyric(song):
    """本地 .lrc 优先，否则在线抓取（失败返回空串）"""
    local = _read_local_lyric(song)
    if local:
        return local
    try:
        return fetch_lrc(song.title, song.artist or "")
    except Exception:
        return ""


def _process(song):
    """处理单首歌，返回 (song, new_tags, new_genre, lyric_len)"""
    lyric = _fetch_lyric(song)
    try:
        result = classify_song(song.title, song.artist or "", lyric)
    except Exception:
        result = {"tags": ["relaxing", "calm"], "genre": ""}
    tags = [t for t in (result.get("tags") or []) if t][:3]
    new_tags = ",".join(tags)
    new_genre = result.get("genre") or ""
    # 原曲风已有值时保留，避免覆盖用户已有的曲风信息
    if song.genre:
        new_genre = song.genre
    return song, new_tags, new_genre, len(lyric)


def retag_songs_for(ids, workers=3, dry_run=False, progress_cb=None):
    """对指定歌曲 id 列表批量 AI 打标

    参数：
        ids:         歌曲主键列表
        workers:     并发数（默认 3，太大可能被歌词源限流）
        dry_run:     True 只预览不写库
        progress_cb: 可选回调 progress_cb(done, total, song, new_tags, new_genre, lyric_len)

    返回: {"processed": n, "changed": n, "failed": n, "cost": n, "tag_stat": {...}}
    """
    todo = list(Song.objects.filter(id__in=ids).order_by("id"))
    total = len(todo)
    if total == 0:
        return {"processed": 0, "changed": 0, "failed": 0, "cost": 0, "tag_stat": {}}

    results = []
    failed = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(_process, s): s for s in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                song, new_tags, new_genre, lyric_len = fut.result()
            except Exception:
                failed += 1
                continue
            results.append((song, new_tags, new_genre))
            if progress_cb:
                try:
                    progress_cb(i, total, song, new_tags, new_genre, lyric_len)
                except Exception:
                    pass

    changed = 0
    if not dry_run:
        for song, new_tags, new_genre in results:
            if song.tags != new_tags:
                Song.objects.filter(id=song.id).update(tags=new_tags, genre=new_genre)
                changed += 1

    tag_stat = {}
    for _, new_tags, _ in results:
        tag_stat[new_tags] = tag_stat.get(new_tags, 0) + 1

    return {
        "processed": total,
        "changed": changed,
        "failed": failed,
        "cost": int(time.time() - t0),
        "tag_stat": tag_stat,
    }
