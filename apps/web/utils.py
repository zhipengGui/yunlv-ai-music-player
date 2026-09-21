# -*- coding: utf-8 -*-
"""web 板块通用工具

cloud_media_url：把本地 /media/ 相对地址转成对象存储绝对地址（方案二）。
- 云模式开启时，歌曲/歌单封面的 URL 输出为云域名绝对地址，
  远程访问者不再经花生壳隧道下载封面图。
- 仅序列化时拼接、不改数据库；回滚只需关闭云开关，零成本。
"""
from django.conf import settings


def cloud_media_url(url):
    """封面等 /media/ 相对地址 → 云端绝对地址；外链 / 空值原样返回。"""
    if not url or not url.startswith("/"):
        return url
    base = (getattr(settings, "CLOUD_STATIC_BASE", "") or "").strip().rstrip("/")
    if base and url.startswith(settings.MEDIA_URL):
        return f"{base}{url}"
    return url
