# -*- coding: utf-8 -*-
"""板块3：歌单管理数据模型
- Playlist：歌单（名称/封面/描述）
- PlaylistSong：歌单与歌曲的关联（含排序位置，支持拖拽排序）

设计说明：
- 在线歌曲添加进歌单时，会在 music.Song 中落库（source="online"），
  以保证歌单内容的持久化
"""
from django.db import models

from web.utils import cloud_media_url


class Playlist(models.Model):
    name = models.CharField("歌单名", max_length=100)
    description = models.TextField("描述", blank=True)
    cover = models.ImageField("封面", upload_to="playlist_covers/", null=True, blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        verbose_name = "歌单"
        verbose_name_plural = "歌单"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "cover": cloud_media_url(self.cover.url) if self.cover else "",
            "song_count": self.entries.count(),
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
        }


class PlaylistSong(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="entries")
    song = models.ForeignKey("music.Song", on_delete=models.CASCADE, related_name="playlist_entries")
    position = models.IntegerField("排序位置", default=0)
    added_at = models.DateTimeField("添加时间", auto_now_add=True)

    class Meta:
        verbose_name = "歌单歌曲"
        verbose_name_plural = "歌单歌曲"
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["playlist", "song"], name="uniq_playlist_song"),
        ]

    def __str__(self):
        return f"{self.playlist.name} - {self.song.title}"
