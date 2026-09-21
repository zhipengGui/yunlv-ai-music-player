# -*- coding: utf-8 -*-
"""板块5 推荐算法（服务层）
- 输入：听歌历史（ListenRecord，按时长加权）
- 算法：标签重合度 + 曲风匹配的相似度评分
- 兜底：无历史或无相似歌曲时返回热门歌单

可升级性：后续替换为协同过滤 / 向量检索，只需重写本文件的核心函数，
保持 daily_recommend 接口不变即可。
"""
from collections import Counter

from music.models import ListenRecord, Song

# 标签命中权重（标签是核心特征）
TAG_WEIGHT = 2.0
# 曲风命中权重
GENRE_WEIGHT = 1.0
# 参考最近多少条听歌记录
MAX_RECORDS = 100


def daily_recommend(limit=10):
    """每日推荐：基于听歌历史，返回推荐歌曲列表"""
    records = ListenRecord.objects.select_related("song").all()[:MAX_RECORDS]
    if not records:
        return _hot_fallback(limit)

    tag_counter = Counter()
    genre_counter = Counter()
    listened_ids = set()

    for r in records:
        listened_ids.add(r.song_id)
        for t in r.song.tag_list:
            tag_counter[t] += 1
        if r.song.genre:
            genre_counter[r.song.genre] += 1

    candidates = Song.objects.exclude(id__in=listened_ids)
    scored = []
    for s in candidates:
        score = sum(TAG_WEIGHT * tag_counter.get(t, 0) for t in s.tag_list)
        if s.genre in genre_counter:
            score += GENRE_WEIGHT * genre_counter[s.genre]
        if score > 0:
            scored.append((score, s))

    scored.sort(key=lambda x: -x[0])
    if not scored:
        return _hot_fallback(limit)

    songs = [s for _, s in scored[:limit]]
    # 记录推荐理由（供前端展示"为什么推荐"）
    reasons = _build_reasons(songs, tag_counter, genre_counter)
    return songs, reasons


def _hot_fallback(limit):
    """兜底：热门歌曲"""
    songs = list(Song.objects.order_by("-play_count")[:limit])
    return songs, {}


def _build_reasons(songs, tag_counter, genre_counter):
    """为每首歌生成推荐理由文本"""
    reasons = {}
    tag_map = {
        "happy": "喜欢开心的歌", "sad": "喜欢忧伤的歌",
        "relaxing": "喜欢放松的歌", "energetic": "喜欢有活力的歌",
        "calm": "喜欢平静的歌", "romantic": "喜欢浪漫的歌",
        "nostalgic": "喜欢怀旧的歌", "focused": "喜欢专注的歌",
        "tired": "喜欢治愈的歌", "angry": "喜欢宣泄的歌",
        "lonely": "喜欢陪伴的歌", "cheerful": "喜欢轻快的歌",
    }
    genre_map = {
        "pop": "流行", "rock": "摇滚", "electronic": "电子",
        "hiphop": "说唱", "rnb": "R&B", "instrumental": "纯音乐",
        "classical": "古典", "jazz": "爵士", "folk": "民谣",
        "acoustic": "原声", "lofi": "Lo-Fi", "ambient": "氛围",
    }
    for s in songs:
        parts = []
        for t in s.tag_list:
            if tag_counter.get(t, 0):
                parts.append(tag_map.get(t, t))
                break  # 取一个最相关标签即可
        if s.genre and genre_counter.get(s.genre, 0):
            parts.append(f"常听{genre_map.get(s.genre, s.genre)}")
        if parts:
            reasons[s.id] = "、".join(parts)
    return reasons
