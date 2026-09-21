# -*- coding: utf-8 -*-
"""板块6 路由：AI 情绪点歌台"""
from django.urls import path

from . import views

urlpatterns = [
    path("songs/", views.mood_songs, name="mood-songs"),
]
