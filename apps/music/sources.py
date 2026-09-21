# -*- coding: utf-8 -*-
"""音乐源抽象层（板块1 核心设计）

所有音乐源实现统一接口，后续接入任何新源（Jamendo / 网易云 / Spotify）
只需新增一个子类并注册，其他代码零改动。

统一接口：
- search(keyword, limit)  -> 返回 Song 对象列表（本地）或 Song 构造数据（在线）
- get_stream_url(song)    -> 返回播放地址
- get_lyrics(song)        -> 返回歌词文本（无则空串）
"""
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
import re

from django.conf import settings


class MusicSource(ABC):
    """音乐源抽象基类"""
    name = "base"
    label = "基础源"

    @abstractmethod
    def search(self, keyword, limit=20):
        ...

    @abstractmethod
    def get_stream_url(self, song):
        ...

    @abstractmethod
    def get_lyrics(self, song):
        ...


class LocalSource(MusicSource):
    """本地曲库源：音乐文件在 music_library/ 中，已扫描入库"""
    name = "local"
    label = "本地曲库"

    def search(self, keyword, limit=20):
        from django.db.models import Q

        from .models import Song
        qs = Song.objects.filter(source="local")
        kw = keyword.strip()
        if kw:
            qs = qs.filter(
                Q(title__icontains=kw) | Q(artist__icontains=kw)
                | Q(album__icontains=kw) | Q(tags__icontains=kw)
            )
        base = list(qs[:limit])

        # 拼音 / 首字母兜底：中文与英文关键词混合也能命中
        if kw and len(base) < limit:
            py = _pinyin_query(kw)
            if py:
                need = limit - len(base)
                hit_ids = {s.id for s in base}
                extra = []
                for s in Song.objects.filter(source="local").order_by("-play_count"):
                    if s.id in hit_ids:
                        continue
                    tp, ti, ap, ai = _pinyin_fields(s)
                    if py in tp or py in ti or py in ap or py in ai:
                        extra.append(s)
                        hit_ids.add(s.id)
                        if len(extra) >= need:
                            break
                base += extra
        return base

    def get_stream_url(self, song):
        return f"/api/music/stream/{song.id}/"

    def get_lyrics(self, song):
        if not song.file_path:
            return ""
        lrc_path = Path(song.file_path).with_suffix(".lrc")
        if not lrc_path.exists():
            # 尝试与歌曲同目录、同名不同后缀的歌词文件
            for ext in (".txt",):
                alt = Path(song.file_path).with_suffix(ext)
                if alt.exists():
                    lrc_path = alt
                    break
            else:
                return ""
        return _read_lrc_text(lrc_path)


class iTunesSource(MusicSource):
    """在线源：iTunes Search API（免费、无需密钥、可商用演示）
    支持搜索与 30 秒试听，作为在线曲库的默认实现。
    """
    name = "online"
    label = "在线曲库 (iTunes)"

    SEARCH_URL = "https://itunes.apple.com/search"

    def search(self, keyword, limit=20):
        import requests
        try:
            resp = requests.get(
                self.SEARCH_URL,
                params={"term": keyword, "media": "music", "limit": limit},
                timeout=4,
            )
            data = resp.json().get("results", [])
        except Exception:
            return []
        songs = []
        for item in data:
            songs.append(self._to_dict(item))
        return songs

    def _to_dict(self, item):
        """在线结果转 Song 构造数据（不在本地数据库落库，前端直接使用）"""
        return {
            "id": None,
            "title": item.get("trackName", ""),
            "artist": item.get("artistName", ""),
            "album": item.get("collectionName", ""),
            "genre": self._map_genre(item.get("primaryGenreName", "")),
            "tags": [],
            "duration": round((item.get("trackTimeMillis") or 0) / 1000, 1),
            "source": "online",
            "source_id": str(item.get("trackId", "")),
            "cover": item.get("artworkUrl100", "").replace("100x100", "300x300"),
            "play_count": 0,
            "stream_url": item.get("previewUrl", ""),
        }

    def _map_genre(self, genre):
        mapping = {
            "pop": "pop", "rock": "rock", "electronic": "electronic",
            "hip hop": "hiphop", "hip-hop": "hiphop", "r&b": "rnb",
            "classical": "classical", "jazz": "jazz", "folk": "folk",
            "lofi": "lofi", "ambient": "ambient", "alternative": "rock",
            "indie": "pop", "soundtrack": "instrumental",
        }
        g = genre.lower()
        for key, val in mapping.items():
            if key in g:
                return val
        return g[:50] or "pop"

    def get_stream_url(self, song):
        # 在线歌曲直接播放 previewUrl
        return song.source_url or song.source_id

    def get_lyrics(self, song):
        # iTunes 不提供歌词，返回空（由板块4 歌词处理兜底）
        return ""


# Jamendo 标签 -> 系统曲风（GENRE_CHOICES）映射
_TAG_GENRE = {
    "pop": "pop", "indie": "pop", "top40": "pop",
    "rock": "rock", "metal": "rock", "alternative": "rock", "punk": "rock",
    "electronic": "electronic", "electro": "electronic", "dance": "electronic",
    "edm": "electronic", "house": "electronic", "techno": "electronic",
    "trance": "electronic", "dubstep": "electronic",
    "hiphop": "hiphop", "rap": "hiphop",
    "rnb": "rnb", "soul": "rnb", "funk": "rnb",
    "instrumental": "instrumental", "soundtrack": "instrumental",
    "piano": "instrumental", "ambient": "ambient", "cinematic": "ambient",
    "chillout": "ambient", "classical": "classical",
    "jazz": "jazz", "blues": "jazz",
    "folk": "folk", "acoustic": "acoustic", "reggae": "folk", "country": "folk",
    "lofi": "lofi",
}


class JamendoSource(MusicSource):
    """在线源：Jamendo 开放平台（免费、需 client_id、CC 授权可完整播放）

    曲库 15 万+ 首独立音乐人作品，支持搜索与完整播放（非 30 秒试听）。
    免费额度每天约 500MB 流量，适合个人/演示场景。
    """
    name = "jamendo"
    label = "Jamendo 完整版"

    API_URL = "https://api.jamendo.com/v3.0/tracks/"
    CACHE_TTL = 600       # 搜索结果内存缓存 10 分钟
    CACHE_MAX = 256       # 最多缓存的关键词数

    def __init__(self):
        self._cache = {}
        self._cache_order = []

    @property
    def client_id(self):
        return getattr(settings, "JAMENDO_CLIENT_ID", "") or ""

    def search(self, keyword, limit=20):
        import requests
        import time as _time
        if not self.client_id:
            return []
        kw = (keyword or "").strip()
        key = (kw, limit)

        # 命中缓存：直接返回（重复搜索词秒回，避免再次踩网络抖动）
        cached = self._cache_get(key)
        if cached is not None:
            return cached

        params = {
            "client_id": self.client_id,
            "format": "json",
            "limit": limit,
            "include": "musicinfo",
        }
        if kw:
            params["search"] = kw

        # Jamendo 服务器在国外，首次请求偶发超时/空响应：重试最多 3 次
        result = None
        for _ in range(3):
            try:
                resp = requests.get(self.API_URL, params=params, timeout=8)
                data = resp.json().get("results", [])
                if data or not kw:
                    result = [self._to_dict(item) for item in data]
                    break
            except Exception:
                pass
            _time.sleep(0.3)

        # 中文等关键词在 Jamendo（欧美曲库）基本搜不到：兜底返回热门曲目，
        # 保证用户至少能听到可完整播放的音乐（由前端提示说明）
        if not result:
            result = self._fetch_hot(limit)

        # Jamendo storage 部分曲目音频缺失（URL 返回 404）：
        # 并行校验并过滤，保证返回的歌曲都能正常播放
        result = self._filter_streamable(result)

        self._cache_set(key, result)
        return result

    def _filter_streamable(self, songs, max_workers=8):
        """并行校验音频地址可用性，过滤 404/403 的曲目"""
        import requests as _requests
        from concurrent.futures import ThreadPoolExecutor, as_completed
        if not songs:
            return []

        def ok(s):
            url = (s.get("stream_url") or "").strip()
            if not url:
                return False
            try:
                r = _requests.get(url, headers={"Range": "bytes=0-0"}, timeout=6)
                return r.status_code in (200, 206)
            except Exception:
                return False

        valid = []
        order = {id(s): i for i, s in enumerate(songs)}
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(ok, s): s for s in songs}
            for fut in as_completed(futures):
                s = futures[fut]
                try:
                    if fut.result():
                        valid.append(s)
                except Exception:
                    pass
        valid.sort(key=lambda s: order[id(s)])
        return valid

    def _fetch_hot(self, limit):
        """拉取 Jamendo 热门曲目（order=popularity_month），带缓存与重试"""
        import requests
        import time as _time
        key = ("__hot__", limit)
        cached = self._cache_get(key)
        if cached is not None:
            return cached

        params = {
            "client_id": self.client_id,
            "format": "json",
            "limit": limit,
            "include": "musicinfo",
            "order": "popularity_month",
        }
        for _ in range(3):
            try:
                resp = requests.get(self.API_URL, params=params, timeout=8)
                data = resp.json().get("results", [])
                result = self._filter_streamable([self._to_dict(item) for item in data])
                self._cache_set(key, result)
                return result
            except Exception:
                _time.sleep(0.3)
        return []

    def _cache_get(self, key):
        import time as _time
        item = self._cache.get(key)
        if item and _time.time() - item[0] < self.CACHE_TTL:
            return item[1]
        return None

    def _cache_set(self, key, result):
        import time as _time
        self._cache[key] = (_time.time(), result)
        self._cache_order.append(key)
        if len(self._cache_order) > self.CACHE_MAX:
            old = self._cache_order.pop(0)
            self._cache.pop(old, None)

    def _to_dict(self, item):
        info = item.get("musicinfo") or {}
        tags = self._extract_tags(info)
        genre = self._map_genre(tags)
        return {
            "id": None,
            "title": item.get("name", ""),
            "artist": item.get("artist_name", ""),
            "album": item.get("album_name", ""),
            "genre": genre,
            "tags": tags[:3],
            "duration": round(item.get("duration") or 0, 1),  # Jamendo 返回秒
            "source": "jamendo",
            "source_id": str(item.get("id", "")),
            "cover": item.get("album_image", ""),
            "play_count": 0,
            "stream_url": item.get("audio", ""),
        }

    def _extract_tags(self, info):
        """兼容 Jamendo musicinfo.tags 的多种结构（dict{genres,instruments,vartags}）"""
        raw = (info or {}).get("tags") or {}
        if isinstance(raw, str):
            return [t.strip() for t in raw.split(",") if t.strip()]
        if isinstance(raw, dict):
            out = []
            for section in ("genres", "instruments", "vartags"):
                for t in raw.get(section) or []:
                    if isinstance(t, str) and t:
                        out.append(t)
            return out
        if isinstance(raw, list):
            return [t for t in raw if isinstance(t, str) and t]
        return []

    def _map_genre(self, tags):
        for t in tags or []:
            g = _TAG_GENRE.get(t.lower())
            if g:
                return g
        return ""

    def get_stream_url(self, song):
        # audio 字段已是完整版 mp3 播放地址
        return song.source_url or ""

    def get_lyrics(self, song):
        # Jamendo 歌词文本需另调接口，返回空（由板块4 歌词处理兜底）
        return ""


class SoundHelixSource(MusicSource):
    """在线源：SoundHelix 无版权演示音乐（免费、无需密钥、完整播放）

    共 17 首纯音乐，作为曲库兜底：Jamendo 搜索无结果或想听背景音乐时可用。
    """
    name = "soundhelix"
    label = "SoundHelix 纯音乐"

    BASE_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{n}.mp3"
    TOTAL = 17

    def search(self, keyword, limit=20):
        kw = (keyword or "").strip().lower()
        songs = []
        for n in range(1, self.TOTAL + 1):
            title = f"SoundHelix Song {n}"
            if kw and kw not in title.lower():
                continue
            songs.append({
                "id": None,
                "title": title,
                "artist": "SoundHelix",
                "album": "无版权纯音乐合集",
                "genre": "instrumental",
                "tags": ["纯音乐", "无版权"],
                "duration": 0,  # 前端加载元数据后显示真实时长
                "source": "soundhelix",
                "source_id": f"sh{n}",
                "cover": "",
                "play_count": 0,
                "stream_url": self.BASE_URL.format(n=n),
            })
            if len(songs) >= limit:
                break
        return songs

    def get_stream_url(self, song):
        return song.source_url or song.source_id or ""

    def get_lyrics(self, song):
        return ""


@lru_cache(maxsize=4096)
def _pinyin_fields(song):
    """缓存歌曲的拼音索引：(标题全拼, 标题首字母, 歌手全拼, 歌手首字母)"""
    from pypinyin import Style, lazy_pinyin

    tp = "".join(lazy_pinyin(song.title, style=Style.NORMAL)).lower()
    ti = "".join(x[0] for x in lazy_pinyin(song.title, style=Style.NORMAL) if x).lower()
    ap = "".join(lazy_pinyin(song.artist, style=Style.NORMAL)).lower()
    ai = "".join(x[0] for x in lazy_pinyin(song.artist, style=Style.NORMAL) if x).lower()
    return tp, ti, ap, ai


def _pinyin_query(kw):
    """把查询词转成可匹配的拼音串（保留英文部分）"""
    from pypinyin import Style, lazy_pinyin

    letters = re.findall(r"[a-zA-Z]+", kw)
    if not letters:
        return ""
    result = ""
    for part in re.split(r"([a-zA-Z]+)", kw):
        if not part:
            continue
        if part[0].isascii() and part[0].isalpha():
            result += part.lower()
        else:
            result += "".join(lazy_pinyin(part, style=Style.NORMAL)).lower()
    return result


def _read_lrc_text(path):
    """读取歌词文件，自动兼容 UTF-8 / GBK / GB18030 编码"""
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "gb18030"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="ignore")


# 已注册的音乐源（按优先级，本地优先；在线按 完整版(Jamendo) > 纯音乐(SoundHelix) > 试听(iTunes)）
SOURCES = {
    "local": LocalSource(),
    "jamendo": JamendoSource(),
    "soundhelix": SoundHelixSource(),
    "online": iTunesSource(),
}


def get_source(name):
    return SOURCES.get(name)


def available_sources():
    """返回当前可用的源列表（供前端展示）"""
    return [{"name": s.name, "label": s.label} for s in SOURCES.values()]
