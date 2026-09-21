# -*- coding: utf-8 -*-
"""板块5 API：推荐系统"""
from django.http import JsonResponse

from .services import daily_recommend


def daily(request):
    """每日推荐：返回推荐歌曲 + 推荐理由"""
    limit = min(int(request.GET.get("limit", 10)), 50)
    songs, reasons = daily_recommend(limit)
    return JsonResponse({
        "songs": [s.to_dict() for s in songs],
        "reasons": reasons,
        "fallback": not reasons,  # 兜底标记（无历史时走热门）
    })
