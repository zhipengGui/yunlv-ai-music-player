# -*- coding: utf-8 -*-
"""板块8：听歌报告与点歌排行榜
数据源：music.ListenRecord（播放历史）+ music.Song.play_count（播放次数）
"""
from collections import Counter
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone

from music.models import GENRE_CHOICES, MOOD_TAG_CHOICES, ListenRecord, Song
from music.sources import get_source

GENRE_LABELS = {name: label for name, label in GENRE_CHOICES}
TAG_LABELS = {name: label for name, label in MOOD_TAG_CHOICES}


def _payload(song):
    d = song.to_dict()
    d["stream_url"] = get_source("local").get_stream_url(song)
    return d


def summary(request):
    """听歌报告：基于全部播放历史聚合统计"""
    records = list(ListenRecord.objects.select_related("song").order_by("-listened_at"))
    if not records:
        return JsonResponse({
            "empty": True,
            "message": "还没有听歌记录，去播放几首喜欢的歌，再来生成你的专属听歌报告吧！",
        })

    now = timezone.localtime()
    today = now.date()
    week_ago = now - timedelta(days=6)

    total = len(records)
    total_sec = sum(r.duration_sec or 0 for r in records)
    unique = len({r.song_id for r in records})

    song_counter = Counter()
    genre_counter = Counter()
    mood_counter = Counter()
    period_counter = Counter()
    daily_counter = Counter()

    for r in records:
        song_counter[r.song_id] += 1
        if r.song.genre:
            genre_counter[r.song.genre] += 1
        for t in r.song.tag_list:
            mood_counter[t] += 1
        lt = timezone.localtime(r.listened_at) if r.listened_at else now
        hour = lt.hour
        period = "上午" if hour < 12 else "下午" if hour < 18 else "晚上"
        period_counter[period] += 1
        if lt.date() >= week_ago.date():
            daily_counter[lt.date().strftime("%m-%d")] += 1

    today_count = sum(1 for r in records
                      if r.listened_at and timezone.localtime(r.listened_at).date() == today)

    # 单曲循环王
    top_song_id, top_times = song_counter.most_common(1)[0]
    top_song = Song.objects.filter(id=top_song_id).first()

    # 最近播放
    latest = records[0].song

    return JsonResponse({
        "empty": False,
        "total": total,
        "unique": unique,
        "minutes": round(total_sec / 60, 1),
        "today_count": today_count,
        "top_song": top_song.title if top_song else "",
        "top_song_times": top_times,
        "top_style": GENRE_LABELS.get(genre_counter.most_common(1)[0][0], genre_counter.most_common(1)[0][0])
                     if genre_counter else "未知",
        "top_mood": TAG_LABELS.get(mood_counter.most_common(1)[0][0], mood_counter.most_common(1)[0][0])
                    if mood_counter else "未知",
        "top_period": period_counter.most_common(1)[0][0] if period_counter else "-",
        "latest": {
            "title": latest.title,
            "artist": latest.artist,
            "ts": timezone.localtime(records[0].listened_at).strftime("%m-%d %H:%M"),
        },
        "styles": [[GENRE_LABELS.get(k, k), v] for k, v in genre_counter.most_common(8)],
        "moods": [[TAG_LABELS.get(k, k), v] for k, v in mood_counter.most_common(8)],
        "periods": dict(period_counter),
        "daily": [{"day": k, "count": v} for k, v in sorted(daily_counter.items())],
    })


def leaderboard(request):
    """点歌排行榜：按播放次数排序（本地歌曲）"""
    songs = Song.objects.filter(source="local").order_by("-play_count")[:20]
    rows = []
    for i, s in enumerate(songs, 1):
        d = _payload(s)
        d["rank"] = i
        rows.append(d)
    return JsonResponse({"leaderboard": rows, "count": len(rows)})


def _relative(delta):
    """把时间差转成口语化描述（供实时播放流展示）"""
    sec = max(0, int(delta.total_seconds()))
    if sec < 60:
        return "刚刚"
    if sec < 3600:
        return f"{sec // 60} 分钟前"
    if sec < 86400:
        return f"{sec // 3600} 小时前"
    return f"{sec // 86400} 天前"


def dashboard(request):
    """数据大屏 API：KPI 汇总 + 趋势 + 情绪/曲风分布 + 热歌榜 + 实时播放流

    与 summary 共用 ListenRecord 数据源，但输出面向"大屏"：
    更偏实时性与可视化，前端 3~5 秒轮询一次。
    """
    records = list(ListenRecord.objects.select_related("song").order_by("-listened_at"))
    now = timezone.localtime()
    today = now.date()
    week_ago = now - timedelta(days=6)

    total = len(records)
    total_sec = sum(r.duration_sec or 0 for r in records)
    unique = len({r.song_id for r in records})

    today_count = 0
    hour_count = 0
    genre_counter = Counter()
    mood_counter = Counter()
    daily_counter = Counter()
    hour_counter = Counter()

    for r in records:
        if r.song.genre:
            genre_counter[r.song.genre] += 1
        for t in r.song.tag_list:
            mood_counter[t] += 1
        lt = timezone.localtime(r.listened_at) if r.listened_at else now
        if lt.date() == today:
            today_count += 1
        if (now - lt).total_seconds() <= 3600:
            hour_count += 1
        if lt.date() >= week_ago.date():
            daily_counter[lt.date().strftime("%m-%d")] += 1
        hour_counter[lt.hour] += 1

    # 近 7 天趋势（补齐缺失日期，保证大屏横轴完整）
    trend = []
    for i in range(7):
        d = (week_ago + timedelta(days=i)).date()
        trend.append({"day": d.strftime("%m-%d"), "count": daily_counter.get(d.strftime("%m-%d"), 0)})

    # 今日 24 小时播放分布
    today_hours = [hour_counter.get(h, 0) for h in range(24)]

    # 实时播放流：最近 12 条
    live_feed = []
    for r in records[:12]:
        lt = timezone.localtime(r.listened_at) if r.listened_at else now
        live_feed.append({
            "id": r.id,
            "title": r.song.title,
            "artist": r.song.artist or "未知",
            "ts": lt.strftime("%H:%M:%S"),
            "relative": _relative(now - lt),
        })

    # 热歌榜（本地真实歌曲）
    hot_songs = [
        {"title": s.title, "artist": s.artist or "未知", "play_count": s.play_count}
        for s in Song.objects.filter(source="local").order_by("-play_count")[:10]
    ]

    top_hour = hour_counter.most_common(1)[0][0] if hour_counter else None
    top_mood = mood_counter.most_common(1)
    top_genre = genre_counter.most_common(1)

    return JsonResponse({
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "empty": total == 0,
        "overview": {
            "total": total,
            "unique": unique,
            "minutes": round(total_sec / 60, 1),
            "today_count": today_count,
            "hour_count": hour_count,
            "top_hour": f"{top_hour}:00" if top_hour is not None else "-",
            "top_mood": TAG_LABELS.get(top_mood[0][0], top_mood[0][0]) if top_mood else "-",
            "top_genre": GENRE_LABELS.get(top_genre[0][0], top_genre[0][0]) if top_genre else "-",
        },
        "trend": trend,
        "today_hours": today_hours,
        "moods": [[TAG_LABELS.get(k, k), v] for k, v in mood_counter.most_common(8)],
        "genres": [[GENRE_LABELS.get(k, k), v] for k, v in genre_counter.most_common(8)],
        "hot_songs": hot_songs,
        "live_feed": live_feed,
    })
