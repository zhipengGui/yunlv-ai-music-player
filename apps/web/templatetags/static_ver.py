# -*- coding: utf-8 -*-
"""静态资源自动版本号模板标签

用法：<script src="{% static_ver 'js/player.js' %}">
输出：static/js/player.js?v=<文件修改时间戳>

按文件 mtime 自动生成版本号，改动文件后无需手动改 ?v=，
缓存 TTL 3 秒，避免同一请求周期内重复 stat。
"""
import time
from pathlib import Path

from django import template
from django.conf import settings

register = template.Library()

# path -> (checked_at, mtime)
_CACHE = {}
_CACHE_TTL = 3


@register.simple_tag
def static_ver(path):
    now = time.time()
    hit = _CACHE.get(path)
    if hit and (now - hit[0]) < _CACHE_TTL:
        mtime = hit[1]
    else:
        try:
            full = Path(settings.BASE_DIR) / "static" / path
            mtime = full.stat().st_mtime
        except OSError:
            mtime = now
        _CACHE[path] = (now, mtime)
    # 云模式（方案二）：静态资源统一从对象存储域名加载，本地模式输出绝对路径
    base = (getattr(settings, "CLOUD_STATIC_BASE", "") or "").strip().rstrip("/")
    prefix = (settings.STATIC_URL or "static/").lstrip("/")  # 兼容 'static/' 与 '/static/'
    if base:
        return f"{base}/{prefix}{path}?v={int(mtime)}"
    return f"/{prefix}{path}?v={int(mtime)}"
