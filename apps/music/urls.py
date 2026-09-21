# -*- coding: utf-8 -*-
"""板块1 路由：音乐核心 API"""
from django.urls import path

from . import views

urlpatterns = [
    path("songs/", views.song_list, name="song-list"),
    path("songs/<int:song_id>/", views.song_detail, name="song-detail"),
    path("songs/<int:song_id>/play/", views.record_play, name="song-play"),
    path("search/", views.search, name="search"),
    path("stream/<int:song_id>/", views.stream, name="stream"),
    path("proxy/", views.proxy_audio, name="proxy-audio"),
    path("scan/", views.scan, name="scan"),
    path("tag_progress/", views.tag_progress, name="tag-progress"),
    path("voice/", views.voice, name="voice"),
    path("hot/", views.hot_songs, name="hot"),
    path("tags/", views.tag_list, name="tags"),
]
