# -*- coding: utf-8 -*-
"""曲库扫描器：扫描 music_library/ 目录，将音频文件读取元数据后入库
- 支持格式：mp3 / flac / wav / m4a / ogg
- 去重策略：按文件路径判断，已入库的跳过
- 元数据读取依赖 mutagen（纯 Python，无额外系统依赖）
"""
import os
from pathlib import Path

from django.conf import settings

from .models import Song

AUDIO_EXTS = {".mp3", ".flac", ".wav", ".m4a", ".ogg"}

# 曲风 -> 默认情绪标签（仅供入库时的"初始猜测"，可在管理后台人工调整）
# 注意：情绪与曲风不是严格对应关系（流行曲里开心/伤心的歌都有），
# 因此 pop 等情绪复杂的曲风不再预设标签，留空交给 AI 按歌词判定；
# 更准确的情绪标签用 `python manage.py retag_songs` 批量生成。
GENRE_DEFAULT_TAGS = {
    "pop": "",                      # 情绪复杂，不预设（交由 AI 按歌词判定）
    "rock": "energetic",
    "electronic": "energetic,focused",
    "hiphop": "energetic",
    "rnb": "romantic,relaxing",
    "instrumental": "relaxing,focused,calm",
    "classical": "calm,focused",
    "jazz": "relaxing,romantic",
    "folk": "nostalgic,calm",
    "acoustic": "calm,nostalgic",
    "lofi": "relaxing,focused,calm",
    "ambient": "calm,relaxing",
}


def scan_library():
    """扫描本地音乐库，返回新增入库歌曲的 id 列表（数量 = len(ids)）

    新歌入库时只按曲风给"初始猜测"标签（GENRE_DEFAULT_TAGS），
    更准确的情绪标签由调用方决定是否触发 retagger.retag_songs_for 批量 AI 打标。
    """
    lib = Path(settings.MUSIC_LIBRARY_DIR)
    lib.mkdir(parents=True, exist_ok=True)
    added_ids = []
    # 内置演示曲已停用：合成的测试音乐不好听且无封面，不再自动生成。
    # 如需恢复，调用 apps/music/demo.py 的 ensure_demo_songs() 即可。
    for root, _, files in os.walk(lib):
        for fname in files:
            ext = Path(fname).suffix.lower()
            if ext not in AUDIO_EXTS:
                continue
            path = Path(root) / fname
            if Song.objects.filter(file_path=str(path)).exists():
                continue  # 已入库，跳过

            info = _read_metadata(path)
            # 无曲风标签时不再强行兜底成 pop（会导致伤感歌曲被误标为 happy），
            # 留空后由 retag_songs / 自动打标按歌词 AI 判定情绪标签
            genre = (info["genre"] or "").strip().lower()
            song = Song.objects.create(
                title=info["title"] or path.stem,
                artist=info["artist"] or "未知歌手",
                album=info["album"] or "",
                genre=genre,
                tags=GENRE_DEFAULT_TAGS.get(genre, ""),
                duration=info["duration"],
                file_path=str(path),
                source="local",
            )
            added_ids.append(song.id)
    return added_ids


def _read_metadata(path):
    """读取音频元数据（mutagen）"""
    default = {"title": "", "artist": "", "album": "", "genre": "", "duration": 0}
    try:
        from mutagen import File
        audio = File(str(path))
        if audio is None:
            return default
        duration = float(audio.info.length) if getattr(audio, "info", None) else 0
        tags = getattr(audio, "tags", None)
        if tags is None:
            return {**default, "duration": duration}
        title = _tag_first(tags, "title", "TIT2", "©nam")
        artist = _tag_first(tags, "artist", "TPE1", "©ART")
        album = _tag_first(tags, "album", "TALB", "©alb")
        genre = _tag_first(tags, "genre", "TCON", "©gen")
        return {
            "title": title, "artist": artist, "album": album,
            "genre": genre, "duration": duration,
        }
    except Exception:
        return default


def _tag_first(tags, *keys):
    """从 mutagen tags 中按 key 顺序取第一个值"""
    for key in keys:
        if key in tags:
            val = tags[key]
            if hasattr(val, "text"):  # id3 等
                vals = val.text
            elif isinstance(val, list):
                vals = val
            else:
                vals = [val]
            if vals:
                return str(vals[0])
    return ""
