# -*- coding: utf-8 -*-
"""板块7 路由：歌词海报 API"""
from django.urls import path

from . import views

urlpatterns = [
    path("palette/", views.palette, name="poster-palette"),
    path("cover/", views.cover, name="poster-cover"),
]
