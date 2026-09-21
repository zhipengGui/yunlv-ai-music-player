# -*- coding: utf-8 -*-
"""板块3 API：歌单管理
- 歌单 CRUD、封面上传
- 歌曲添加/移除（在线歌曲自动落库）
- 拖拽排序
"""
import json

from django.db.models import Max
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from music.models import Song

from .models import Playlist, PlaylistSong


def playlist_list(request):
    """歌单列表"""
    playlists = Playlist.objects.all()
    return JsonResponse({"playlists": [p.to_dict() for p in playlists]})


@csrf_exempt
def playlist_create(request):
    """创建歌单（POST：name 必填）"""
    name = (request.POST.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "歌单名称不能为空"}, status=400)
    p = Playlist.objects.create(
        name=name,
        description=request.POST.get("description", ""),
    )
    if request.FILES.get("cover"):
        p.cover = request.FILES["cover"]
        p.save()
    return JsonResponse(p.to_dict(), status=201)


def playlist_detail(request, playlist_id):
    """歌单详情（含歌曲列表，歌曲按 position 排序）"""
    p = get_object_or_404(Playlist, id=playlist_id)
    songs = [e.song for e in p.entries.all()]
    return JsonResponse({
        **p.to_dict(),
        "songs": [s.to_dict() for s in songs],
    })


@csrf_exempt
def playlist_update(request, playlist_id):
    """更新歌单（名称/描述/封面）"""
    p = get_object_or_404(Playlist, id=playlist_id)
    if "name" in request.POST:
        name = request.POST["name"].strip()
        if name:
            p.name = name
    if "description" in request.POST:
        p.description = request.POST["description"]
    if request.FILES.get("cover"):
        p.cover = request.FILES["cover"]
    p.save()
    return JsonResponse(p.to_dict())


@csrf_exempt
def playlist_delete(request, playlist_id):
    """删除歌单"""
    p = get_object_or_404(Playlist, id=playlist_id)
    p.delete()
    return JsonResponse({"ok": True})


@csrf_exempt
def playlist_add_song(request, playlist_id):
    """向歌单添加歌曲
    POST body（JSON）：
      - {"song_id": 3}                       本地歌曲
      - {"song": {title, artist, source_id, stream_url, ...}}  在线歌曲
    """
    p = get_object_or_404(Playlist, id=playlist_id)
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "请求格式错误"}, status=400)

    if data.get("song_id"):
        song = get_object_or_404(Song, id=data["song_id"])
    elif data.get("song"):
        song = _get_or_create_online_song(data["song"])
    else:
        return JsonResponse({"error": "缺少歌曲信息"}, status=400)

    if p.entries.filter(song=song).exists():
        return JsonResponse({"error": "歌曲已在歌单中"}, status=400)

    max_pos = p.entries.aggregate(m=Max("position"))["m"] or 0
    PlaylistSong.objects.create(playlist=p, song=song, position=max_pos + 1)
    return JsonResponse({"ok": True, "song": song.to_dict()}, status=201)


@csrf_exempt
def playlist_remove_song(request, playlist_id, song_id):
    """从歌单移除歌曲"""
    p = get_object_or_404(Playlist, id=playlist_id)
    PlaylistSong.objects.filter(playlist=p, song_id=song_id).delete()
    return JsonResponse({"ok": True})


@csrf_exempt
def playlist_reorder(request, playlist_id):
    """拖拽排序：POST body = {"order": [song_id, song_id, ...]}"""
    p = get_object_or_404(Playlist, id=playlist_id)
    try:
        data = json.loads(request.body or b"{}")
        order = data.get("order", [])
    except Exception:
        return JsonResponse({"error": "请求格式错误"}, status=400)
    if not order:
        return JsonResponse({"error": "排序列表为空"}, status=400)
    for pos, song_id in enumerate(order):
        PlaylistSong.objects.filter(playlist=p, song_id=song_id).update(position=pos)
    return JsonResponse({"ok": True})


def _get_or_create_online_song(data):
    """在线歌曲落库（按 source + source_id 去重）"""
    source_id = str(data.get("source_id", "") or "")
    if source_id:
        song = Song.objects.filter(source="online", source_id=source_id).first()
        if song:
            return song
    return Song.objects.create(
        title=data.get("title") or "未知标题",
        artist=data.get("artist", ""),
        album=data.get("album", ""),
        genre=data.get("genre", ""),
        tags=",".join(data.get("tags") or []),
        duration=float(data.get("duration") or 0),
        source="online",
        source_id=source_id,
        source_url=data.get("stream_url", ""),
    )
