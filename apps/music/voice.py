# -*- coding: utf-8 -*-
"""语音 / 文本点歌解析（板块8 · 语音点歌）

支持说法示例：
  "播放一首舒缓的歌" "来点周小云的歌" "放首钢琴曲"
  "点一首夏日晴空" "随便来一首"

解析优先级：歌手 -> 歌名 -> 情绪词 -> 风格词 -> 拼音 -> 随机兜底
"""
import random
import re

from .models import GENRE_CHOICES, MOOD_TAG_CHOICES, Song
from .sources import get_source, _pinyin_query

# 中文标签 -> 内部词（情绪词表 label -> name）
GENRE_LABELS = {label: name for name, label in GENRE_CHOICES}
TAG_LABELS = {label: name for name, label in MOOD_TAG_CHOICES}
# 口语别名（舒缓=calm 等），防止漏匹配
MOOD_ALIAS = {"放松": "relaxing", "安静": "calm", "平静": "calm", "开心": "happy",
              "快乐": "happy", "活力": "energetic", "轻快": "cheerful",
              "浪漫": "romantic", "怀旧": "nostalgic", "治愈": "calm",
              "宁静": "calm", "燃": "energetic", "舒缓": "calm",
              "温馨": "calm", "励志": "energetic", "伤感": "sad",
              "难过": "sad", "孤独": "lonely"}

# 风格口语别名（钢琴=纯音乐 等）
GENRE_ALIAS = {"钢琴": "instrumental", "纯音乐": "instrumental", "纯音": "instrumental",
               "轻音乐": "instrumental", "轻音": "instrumental",
               "民谣": "folk", "流行": "pop", "电子": "electronic",
               "电音": "electronic", "摇滚": "rock", "说唱": "hiphop",
               "爵士": "jazz", "古典": "classical", "氛围": "ambient",
               "原声": "acoustic"}


def _payload(song):
    d = song.to_dict()
    d["stream_url"] = get_source("local").get_stream_url(song)
    return d


def parse_voice(text, limit=12):
    """解析语音/文本点歌指令，返回 {"hint": str, "songs": [payload...]}"""
    text = (text or "").strip()
    if not text:
        return {"hint": "没有听到内容，请再说一次", "songs": []}

    # 1) 歌手名直接命中
    artists = set(Song.objects.filter(source="local")
                  .exclude(artist="").values_list("artist", flat=True))
    for artist in artists:
        if artist and artist in text:
            songs = list(Song.objects.filter(source="local", artist=artist)[:limit])
            return {"hint": f"为你点播歌手「{artist}」的作品", "songs": [_payload(s) for s in songs]}

    # 2) 歌名直接命中
    titles = Song.objects.filter(source="local").values_list("title", flat=True)
    for title in titles:
        if title and title in text:
            s = Song.objects.filter(source="local", title=title).first()
            return {"hint": f"为你点播《{title}》", "songs": [_payload(s)] if s else []}

    # 3) 情绪词命中（如：舒缓 / 放松 / 开心）
    tag_hits = []
    for label, name in TAG_LABELS.items():
        if label in text or label in MOOD_ALIAS and text.startswith(label):
            tag_hits.append(name)
    for alias, name in MOOD_ALIAS.items():
        if alias in text and name not in tag_hits:
            tag_hits.append(name)
    if tag_hits:
        songs = (Song.objects.filter(source="local", tags__icontains=tag_hits[0])
                 .order_by("-play_count")[:limit])
        # 回显用户说的词（如「舒缓」），找不到再用词表 label
        user_word = next((w for w in list(MOOD_ALIAS) + list(TAG_LABELS) if w in text),
                         tag_hits[0])
        return {"hint": f"为你挑选了 {songs.count()} 首「{user_word}」的歌曲",
                "songs": [_payload(s) for s in songs]}

    # 4) 风格词命中（如：钢琴 / 民谣 / 电子 / 爵士）
    genre_checked = set()
    for label, name in {**GENRE_LABELS, **GENRE_ALIAS}.items():
        if name in genre_checked:
            continue
        if label in text:
            genre_checked.add(name)
            songs = (Song.objects.filter(source="local", genre=name)
                     .order_by("-play_count")[:limit])
            return {"hint": f"为你挑选了 {songs.count()} 首「{label}」歌曲",
                    "songs": [_payload(s) for s in songs]}

    # 5) 拼音尝试（如说 "laifuyikuan..." 或输入 zxy）
    py = _pinyin_query(text)
    if py:
        songs = get_source("local").search(py, limit=limit)
        if songs:
            return {"hint": f"我猜你想找「{songs[0].title}」",
                    "songs": [_payload(s) for s in songs]}

    # 6) 随机兜底
    if any(k in text for k in ("随便", "随机", "来一首", "放个", "来点")):
        s = Song.objects.filter(source="local").order_by("?").first()
        if s:
            return {"hint": f"随机为你播放《{s.title}》", "songs": [_payload(s)]}

    return {"hint": f"没听懂「{text}」，试试说『放一首舒缓的歌』『来点周小云的歌』",
            "songs": []}
