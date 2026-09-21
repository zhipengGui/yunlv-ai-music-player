# -*- coding: utf-8 -*-
"""板块3 路由：歌单管理 API"""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.playlist_list, name="playlist-list"),
    path("create/", views.playlist_create, name="playlist-create"),
    path("<int:playlist_id>/", views.playlist_detail, name="playlist-detail"),
    path("<int:playlist_id>/update/", views.playlist_update, name="playlist-update"),
    path("<int:playlist_id>/delete/", views.playlist_delete, name="playlist-delete"),
    path("<int:playlist_id>/songs/", views.playlist_add_song, name="playlist-add-song"),
    path("<int:playlist_id>/songs/<int:song_id>/", views.playlist_remove_song, name="playlist-remove-song"),
    path("<int:playlist_id>/reorder/", views.playlist_reorder, name="playlist-reorder"),
]
