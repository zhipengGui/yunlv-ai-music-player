# -*- coding: utf-8 -*-
"""板块7 API：歌词海报
- palette：返回曲风渐变配色 + 情绪配色（前端 Canvas 绘制使用）
- cover：在线封面图代理（解决跨域导致 canvas 被污染、PNG 导出失败）
- V1.1 可扩展：海报分享记录、AIGC 意境图生成
"""
from urllib.parse import urlparse

import requests
from django.http import HttpResponse, JsonResponse

# 复用音乐源代理白名单，避免被当作开放图片代理滥用
from music.proxy_cache import host_allowed

# 曲风 -> 海报渐变配色（前端兜底内置同一份）
PALETTES = {
    "pop": ["#FF6B6B", "#FFD93D"],
    "rock": ["#2B2D42", "#EF233C"],
    "electronic": ["#4A00E0", "#8E2DE2"],
    "hiphop": ["#1D976C", "#93F9B9"],
    "rnb": ["#642B73", "#C6426E"],
    "instrumental": ["#56CCF2", "#2F80ED"],
    "classical": ["#B79891", "#94716B"],
    "jazz": ["#F7971E", "#FFD200"],
    "folk": ["#8E9EAB", "#EEF2F3"],
    "acoustic": ["#CAC531", "#F3F9A7"],
    "lofi": ["#9796F0", "#FBC8D5"],
    "ambient": ["#00C9FF", "#92FE9D"],
    "default": ["#7c5cff", "#00d4ff"],
}

# 12 个情绪标签 -> 海报主配色（「情绪光影」模板使用）
EMOTION_PALETTES = {
    "happy": ["#f6d365", "#fda085"],
    "sad": ["#4b6cb7", "#182848"],
    "relaxing": ["#56ab2f", "#a8e063"],
    "energetic": ["#f83600", "#f9d423"],
    "calm": ["#74ebd5", "#9face6"],
    "romantic": ["#f093fb", "#f5576c"],
    "nostalgic": ["#d4a373", "#7f5539"],
    "focused": ["#414345", "#232526"],
    "tired": ["#616161", "#9bc5c3"],
    "angry": ["#c31432", "#240b36"],
    "lonely": ["#5c6bc0", "#8e24aa"],
    "cheerful": ["#f7971e", "#ffd200"],
}


def palette(request):
    genre = request.GET.get("genre", "")
    colors = PALETTES.get(genre, PALETTES["default"])
    return JsonResponse({
        "genre": genre,
        "colors": colors,
        "palettes": PALETTES,
        "emotions": EMOTION_PALETTES,
    })


# 允许的图片 Content-Type（防代理任意网页内容）
_IMG_CTYPES = ("image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg")


def cover(request):
    """在线封面图代理：把跨域封面图转为同源，避免 canvas 被污染导致 toBlob 失败。

    用法：GET /api/posters/cover/?url=<原封面图地址>
    - 仅放行音乐源白名单域名（与音频代理一致）
    - 仅转发图片类型响应
    - 浏览器侧缓存 7 天，重复播放不再回源
    """
    raw = request.GET.get("url", "").strip()
    if not raw.lower().startswith(("http://", "https://")):
        return JsonResponse({"error": "不支持的图片地址"}, status=400)
    if len(raw) > 2048:
        return JsonResponse({"error": "图片地址过长"}, status=400)
    if not host_allowed(raw):
        return JsonResponse({"error": "该图片源不在允许的白名单内"}, status=403)

    try:
        # 流式拉取上游图片并转发字节，不在内存里整图缓存
        upstream = requests.get(
            raw,
            headers={"User-Agent": "Mozilla/5.0 YunLy/1.0 Poster"},
            timeout=10,
            stream=True,
        )
    except Exception:
        return JsonResponse({"error": "图片源连接失败"}, status=502)

    if upstream.status_code != 200:
        upstream.close()
        return JsonResponse({"error": "图片源返回 " + str(upstream.status_code)}, status=502)

    ctype = (upstream.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    if ctype not in _IMG_CTYPES:
        upstream.close()
        return JsonResponse({"error": "上游返回的内容不是图片"}, status=502)

    def gen():
        try:
            for chunk in upstream.iter_content(chunk_size=32 * 1024):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    resp = HttpResponse(gen(), content_type=ctype)
    # 浏览器缓存 7 天；同一封面重复播放不再回源
    resp["Cache-Control"] = "public, max-age=604800"
    resp["Access-Control-Allow-Origin"] = "*"
    return resp
