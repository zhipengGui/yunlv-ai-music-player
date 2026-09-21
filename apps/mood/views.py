# -*- coding: utf-8 -*-
"""板块6 API：AI 情绪点歌台（对话式）
流程：心情文本 → 大模型情绪分析 → 加权打分匹配曲库 → 返回推荐
升级能力：
- 多轮追问：请求带 history，AI 结合前文重新分析
- 换一批：带 cached_result + exclude_ids，复用上次解析结果零 AI 调用
- 推荐理由：每首歌返回一行"为什么推荐"
- 个性化排序：结合听歌历史口味（ListenRecord）加分
"""
import json
from collections import Counter

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from music.models import ListenRecord, Song

from .ai_service import analyze_mood

# 打分权重：主情绪 > 氛围标签 > 曲风 > 多标签叠加 > 个性化口味
EMOTION_WEIGHT = 3.0   # 命中主情绪（用户此刻心情）额外加成
TAG_WEIGHT = 2.0       # 命中氛围标签
GENRE_WEIGHT = 1.0     # 命中曲风
MULTI_HIT_EXTRA = 0.5  # 每命中一个标签的叠加加成
PERSONAL_WEIGHT = 1.0  # 常听曲风/标签的个性化加成

# 标签/曲风中文名（与 music/models.py、recommend 保持一致）
TAG_LABELS = {
    "happy": "开心", "sad": "难过", "relaxing": "放松", "energetic": "充满活力",
    "calm": "平静", "romantic": "浪漫", "nostalgic": "怀旧", "focused": "专注",
    "tired": "疲惫", "angry": "愤怒", "lonely": "孤独", "cheerful": "轻快",
}
GENRE_LABELS = {
    "pop": "流行", "rock": "摇滚", "electronic": "电子", "hiphop": "说唱",
    "rnb": "R&B", "instrumental": "纯音乐", "classical": "古典", "jazz": "爵士",
    "folk": "民谣", "acoustic": "原声", "lofi": "Lo-Fi", "ambient": "氛围",
}


@csrf_exempt
def mood_songs(request):
    """情绪点歌：POST body = {"text": "...", "history": [...], "exclude_ids": [...], "cached_result": {...}}"""
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "请求格式错误"}, status=400)

    text = (data.get("text") or "").strip()
    if not text:
        return JsonResponse({"error": "请输入你的心情"}, status=400)

    history = data.get("history") or []
    cached_result = data.get("cached_result")
    exclude_ids = [int(x) for x in (data.get("exclude_ids") or []) if str(x).isdigit()]

    if isinstance(cached_result, dict) and (cached_result.get("tags") or cached_result.get("genres")):
        # 「换一批」：复用上次解析结果，跳过 AI 调用
        result = {
            "emotions": cached_result.get("emotions") or [],
            "tags": cached_result.get("tags") or [],
            "genres": cached_result.get("genres") or [],
            "description": cached_result.get("description") or "换个角度，再给你挑一批",
        }
    else:
        result = analyze_mood(text, history)

    songs, reasons = _query_songs(result, limit=int(data.get("limit", 20)), exclude_ids=exclude_ids)

    return JsonResponse({
        "text": text,
        **result,
        "songs": [{**s.to_dict(), "reason": reasons.get(s.id, "")} for s in songs],
        "count": len(songs),
    })


def _query_songs(result, limit=20, exclude_ids=None):
    """按 AI 输出的标签/曲风查询歌曲，加权打分排序；无任何匹配时兜底热门"""
    emotions = result.get("emotions") or []
    tags = list(dict.fromkeys(emotions + (result.get("tags") or [])))
    genres = result.get("genres") or []

    q = Q()
    for t in tags:
        q |= Q(tags__icontains=t)
    for g in genres:
        q |= Q(genre=g)
    if not q:
        songs = list(Song.objects.order_by("-play_count")[:limit])
        return songs, {}

    qs = Song.objects.filter(q).exclude(file_path__icontains="demo")
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)

    tag_counter, genre_counter = _personal_preferences()

    scored = []
    for s in qs[:150]:
        score, he, ht, hg = _score_song(s, emotions, tags, genres, tag_counter, genre_counter)
        if score > 0:
            scored.append((score, s, he, ht, hg))
    scored.sort(key=lambda x: -x[0])

    picked = scored[:limit]
    songs = [s for _, s, _, _, _ in picked]
    reasons = {s.id: _build_reason(he, ht, hg) for _, s, he, ht, hg in picked}
    return songs, reasons


def _personal_preferences():
    """听歌历史口味：最近 100 条记录的标签/曲风偏好计数"""
    tag_counter = Counter()
    genre_counter = Counter()
    for r in ListenRecord.objects.select_related("song").all()[:100]:
        for t in r.song.tag_list:
            tag_counter[t] += 1
        if r.song.genre:
            genre_counter[r.song.genre] += 1
    return tag_counter, genre_counter


def _score_song(s, emotions, tags, genres, tag_counter, genre_counter):
    """单曲打分：主情绪 > 氛围 > 曲风 > 多标签叠加 > 个性化口味

    返回 (分数, 命中主情绪, 命中氛围, 命中曲风)
    """
    score = 0.0
    hit_emotions, hit_tags, hit_genres = [], [], []
    for t in s.tag_list:
        if t in tags:
            score += TAG_WEIGHT
            if t in emotions:
                score += EMOTION_WEIGHT  # 主情绪额外加成
                hit_emotions.append(t)
            else:
                hit_tags.append(t)
            score += MULTI_HIT_EXTRA  # 多标签叠加
    if s.genre in genres:
        score += GENRE_WEIGHT
        hit_genres.append(s.genre)
    # 个性化：常听曲风 / 常听标签
    if s.genre and genre_counter.get(s.genre):
        score += PERSONAL_WEIGHT
    for t in s.tag_list:
        if tag_counter.get(t):
            score += PERSONAL_WEIGHT * 0.5
    return score, hit_emotions, hit_tags, hit_genres


def _build_reason(hit_emotions, hit_tags, hit_genres):
    """推荐理由：贴合心情 → 曲风 → 氛围 → 默认"""
    parts = []
    if hit_emotions:
        parts.append(f"贴合你的心情（{TAG_LABELS.get(hit_emotions[0], hit_emotions[0])}）")
    if hit_genres:
        parts.append(f"你想要的{GENRE_LABELS.get(hit_genres[0], hit_genres[0])}")
    if hit_tags:
        parts.append(f"氛围{TAG_LABELS.get(hit_tags[0], hit_tags[0])}")
    if not parts:
        parts.append("氛围契合")
    return "、".join(parts)
