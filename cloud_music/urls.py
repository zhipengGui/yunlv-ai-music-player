"""
云律总路由
各板块统一挂在 /api/<板块>/ 下，便于后续升级为 DRF 或拆分微服务
页面路由由 web 板块负责
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    # ---- 访问控制 ----
    path("gate/", include("gate.urls")),

    # ---- 板块路由 ----
    path("", include("web.urls")),              # 板块2 前端页面
    path("api/music/", include("music.urls")),  # 板块1 音乐核心
    path("api/playlists/", include("playlists.urls")),  # 板块3 歌单
    path("api/lyrics/", include("lyrics.urls")),        # 板块4 歌词
    path("api/recommend/", include("recommend.urls")),  # 板块5 推荐
    path("api/mood/", include("mood.urls")),            # 板块6 AI 情绪
    path("api/posters/", include("posters.urls")),      # 板块7 海报
    path("api/report/", include("report.urls")),        # 板块8 听歌报告与排行榜
]

# 开发环境下提供 media 文件访问（封面图）
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
