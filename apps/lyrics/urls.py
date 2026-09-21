# -*- coding: utf-8 -*-
"""板块4 路由：歌词 API"""
from django.urls import path

from . import views

urlpatterns = [
    path("<int:song_id>/", views.get_lyrics, name="lyrics-get"),
    path("analyze/", views.analyze_lyrics, name="lyrics-analyze"),
]
