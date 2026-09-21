# -*- coding: utf-8 -*-
"""板块1：音乐核心数据模型
- Song：歌曲（本地 + 在线统一建模）
- ListenRecord：听歌记录（推荐系统的原料）

设计说明：
- tags 用逗号分隔字符串存储（如 "relaxing,calm,instrumental"），
  便于按标签查询（情绪点歌台核心依赖）
- source 区分本地/在线，配合音乐源抽象层，后续扩展新源只需加一条
"""
from django.db import models

from web.utils import cloud_media_url

# 情绪标签词表：AI 情绪分析输出与歌曲标签的桥梁
MOOD_TAG_CHOICES = [
    ("happy", "开心"),
    ("sad", "难过"),
    ("relaxing", "放松"),
    ("energetic", "充满活力"),
    ("calm", "平静"),
    ("romantic", "浪漫"),
    ("nostalgic", "怀旧"),
    ("focused", "专注"),
    ("tired", "疲惫"),
    ("angry", "愤怒"),
    ("lonely", "孤独"),
    ("cheerful", "轻快"),
]

# 曲风词表
GENRE_CHOICES = [
    ("pop", "流行"),
    ("rock", "摇滚"),
    ("electronic", "电子"),
    ("hiphop", "说唱"),
    ("rnb", "R&B"),
    ("instrumental", "纯音乐"),
    ("classical", "古典"),
    ("jazz", "爵士"),
    ("folk", "民谣"),
    ("acoustic", "原声"),
    ("lofi", "Lo-Fi"),
    ("ambient", "氛围"),
]


class Song(models.Model):
    """歌曲（本地曲库与在线源统一模型）"""
    title = models.CharField("标题", max_length=200)
    artist = models.CharField("歌手", max_length=200, blank=True)
    album = models.CharField("专辑", max_length=200, blank=True)
    genre = models.CharField("曲风", max_length=50, blank=True, choices=GENRE_CHOICES)
    tags = models.CharField("情绪标签", max_length=300, blank=True,
                            help_text="逗号分隔，如：relaxing,calm,instrumental")
    duration = models.FloatField("时长(秒)", default=0)

    # 本地文件
    file_path = models.CharField("本地文件路径", max_length=500, blank=True)
    cover = models.ImageField("封面", upload_to="covers/", null=True, blank=True)

    # 来源（本地 / 在线）
    source = models.CharField("来源", max_length=20, default="local",
                              choices=[("local", "本地"), ("online", "在线")])
    source_id = models.CharField("源内ID", max_length=100, blank=True)
    source_url = models.CharField("播放地址", max_length=1000, blank=True)

    # 本地歌曲上传对象存储后的公网直链（方案一：音频上云加速远程播放）。
    # 非空时 /api/music/stream/<id>/ 直接 302 到该地址；为空则仍读本地文件，天然回退。
    cloud_url = models.CharField("云端直链", max_length=1000, blank=True,
                                 help_text="本地歌曲上传对象存储后的公网直链")

    play_count = models.IntegerField("播放次数", default=0)
    lyrics_fetched = models.BooleanField("已尝试获取歌词", default=False,
                                         help_text="无本地歌词时是否已尝试在线获取")
    created_at = models.DateTimeField("入库时间", auto_now_add=True)

    class Meta:
        verbose_name = "歌曲"
        verbose_name_plural = "歌曲"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["genre"]),
            models.Index(fields=["source"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.artist}"

    @property
    def tag_list(self):
        return [t.strip().lower() for t in self.tags.split(",") if t.strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "genre": self.genre,
            "tags": self.tag_list,
            "duration": round(self.duration, 1),
            "source": self.source,
            "source_id": self.source_id,
            "cover": cloud_media_url(self.cover.url) if self.cover else "",
            "play_count": self.play_count,
        }


class ListenRecord(models.Model):
    """听歌记录（推荐与统计的基础数据）"""
    song = models.ForeignKey(Song, on_delete=models.CASCADE, related_name="listen_records")
    listened_at = models.DateTimeField("播放时间", auto_now_add=True)
    duration_sec = models.FloatField("听歌时长(秒)", default=0)

    class Meta:
        verbose_name = "听歌记录"
        verbose_name_plural = "听歌记录"
        ordering = ["-listened_at"]
