# -*- coding: utf-8 -*-
"""板块4 API：歌词
- 本地歌曲：优先读同目录 .lrc / .txt 文件（兼容网易云 JSON 歌词）
- 无本地歌词：自动到网易云在线获取，成功后缓存为 .lrc 文件
- 在线歌曲：源不提供歌词时返回空，由前端显示兜底文案
- 歌词逐句情绪分析（歌词情绪曲线）：POST /api/lyrics/analyze/
"""
import json
from pathlib import Path

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from mood.ai_service import analyze_lyric_emotions
from music.models import Song
from music.sources import get_source

from .lrc_utils import normalize
from .netease import fetch_lrc


def _save_lrc_file(song, lrc):
    """将获取到的歌词缓存为 .lrc 文件（UTF-8），失败静默跳过"""
    if not song.file_path:
        return
    try:
        Path(song.file_path).with_suffix(".lrc").write_text(lrc, encoding="utf-8")
    except Exception:
        pass


def get_lyrics(request, song_id):
    """返回歌曲歌词（标准 LRC 文本，前端解析渲染）"""
    song = get_object_or_404(Song, id=song_id)
    lrc = ""
    src = get_source(song.source)
    if src:
        try:
            lrc = src.get_lyrics(song)
        except Exception:
            lrc = ""
    lrc = normalize(lrc)

    # 本地歌曲无歌词 -> 自动在线获取（每首歌只尝试一次）
    if not lrc and song.source == "local" and not song.lyrics_fetched:
        try:
            fetched = normalize(fetch_lrc(song.title, song.artist or ""))
        except Exception:
            fetched = ""
        Song.objects.filter(id=song.id).update(lyrics_fetched=True)
        if fetched:
            lrc = fetched
            _save_lrc_file(song, fetched)

    return JsonResponse({
        "song_id": song.id,
        "title": song.title,
        "artist": song.artist,
        "lrc": lrc,
        "has_lrc": bool(lrc),
    })


@csrf_exempt
def analyze_lyrics(request):
    """歌词逐句情绪分析：POST body = {"lines": [{"index":0,"text":".."}], "title":"..", "artist":".."}
    返回 {"emotions": [{"index":0, "emotion":"sad", "score":0.8}, ...]}
    前端将歌词行文本发来，后端做 AI 分析（失败自动回退本地规则引擎），曲线绘制在前端
    """
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "请求格式错误"}, status=400)

    raw_lines = data.get("lines")
    if not isinstance(raw_lines, list) or not raw_lines:
        return JsonResponse({"error": "缺少歌词内容"}, status=400)

    lines = []
    for raw in raw_lines:
        if isinstance(raw, str):
            text = raw
        elif isinstance(raw, dict):
            text = raw.get("text", "")
        else:
            continue
        text = str(text).strip()
        if text:
            lines.append({"index": len(lines), "text": text})

    if not lines:
        return JsonResponse({"error": "歌词内容为空"}, status=400)

    emotions = analyze_lyric_emotions(
        lines, data.get("title", ""), data.get("artist", ""))
    return JsonResponse({"emotions": emotions})
