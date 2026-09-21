# -*- coding: utf-8 -*-
"""在线歌词获取

歌词源（按顺序尝试）：
1. 网易云音乐公开接口（中文歌覆盖好）
2. lrclib.net 开源歌词库（英文歌兜底）

仅用于个人学习项目演示；获取成功后在本地缓存为 .lrc 文件，
下次播放直接读文件，不再请求网络。
"""
import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

SEARCH_URL = "https://music.163.com/api/search/get/web"
LYRIC_URL = "https://music.163.com/api/song/lyric"
LRCLIB_URL = "https://lrclib.net/api/search"

# 无实际歌手名的兜底值（来自文件名/标签），搜索时忽略
_FAKE_ARTISTS = {"未知歌手", "unknown", "未知", "群星"}


def _headers():
    return {
        "User-Agent": UA,
        "Referer": "https://music.163.com/",
        "Cookie": "os=pc; appver=2.9.7",
    }


def _clean_artist(artist):
    if not artist:
        return ""
    a = artist.strip()
    return "" if a.lower() in _FAKE_ARTISTS else a


# ---------- 源1：网易云 ----------

def _search_song_id(title, artist):
    """按歌名+歌手搜索，返回第一个匹配的歌曲 id（失败返回 None）"""
    keyword = ("{} {}".format(title, artist or "")).strip()
    if not keyword:
        return None
    try:
        resp = requests.post(
            SEARCH_URL,
            data={"s": keyword, "type": 1, "limit": 5, "offset": 0},
            headers=_headers(),
            timeout=6,
        )
        data = resp.json()
    except Exception:
        return None
    songs = (data.get("result") or {}).get("songs") or []
    if not songs:
        return None
    # 精确匹配优先：歌手一致则直接取，否则取第一条
    if artist:
        artist_low = artist.lower()
        for s in songs:
            name = s.get("name", "")
            ar = [a.get("name", "").lower() for a in (s.get("artists") or [])]
            if name.strip().lower() == title.strip().lower() and artist_low in ar:
                return s.get("id")
    return songs[0].get("id")


def _get_lrc(song_id):
    """按 song id 获取标准 LRC 歌词（纯音乐/失败返回空串）"""
    try:
        resp = requests.get(
            LYRIC_URL,
            params={"id": song_id, "lv": -1, "kv": -1, "tv": -1},
            headers=_headers(),
            timeout=6,
        )
        data = resp.json()
    except Exception:
        return ""
    lrc = (data.get("lrc") or {}).get("lyric", "")
    if not lrc:
        # 尝试逐字歌词（klyric），失败即视为无歌词
        lrc = (data.get("klyric") or {}).get("lyric", "")
    if not lrc:
        return ""
    if "纯音乐" in lrc or (lrc.strip().count("\n") == 0 and "[" not in lrc):
        return ""
    return lrc


def _fetch_netease(title, artist):
    sid = _search_song_id(title, artist)
    if not sid and artist:
        # 带歌手搜不到时，退化为只搜歌名（翻唱/改版歌歌手名常不匹配）
        sid = _search_song_id(title, "")
    if not sid:
        return ""
    return _get_lrc(sid)


# ---------- 源2：lrclib（英文歌兜底） ----------

def _fetch_lrclib(title, artist):
    title_low = title.strip().lower()
    artist_low = artist.lower()
    # 先带歌手搜索，无结果时退化为只搜歌名
    queries = [("{} {}".format(title, artist)).strip()]
    if artist and artist_low not in _FAKE_ARTISTS:
        queries.append(title)
    for q in queries:
        try:
            resp = requests.get(
                LRCLIB_URL,
                params={"q": q},
                headers={"User-Agent": "cloud-lyric-player (student project)"},
                timeout=6,
            )
            results = resp.json()
        except Exception:
            continue
        if not isinstance(results, list) or not results:
            continue
        # 优先：歌名完全一致
        for r in results:
            if (r.get("name") or "").strip().lower() == title_low:
                lyric = (r.get("syncedLyrics") or "").strip()
                if lyric:
                    return lyric
        # 兜底：第一条带时间轴歌词的结果
        for r in results:
            lyric = (r.get("syncedLyrics") or "").strip()
            if lyric:
                return lyric
    return ""


# ---------- 入口 ----------

def fetch_lrc(title, artist):
    """按 歌名+歌手 获取歌词（LRC 文本），全部失败返回空串"""
    if not title:
        return ""
    artist = _clean_artist(artist)
    lrc = _fetch_netease(title, artist)
    if lrc:
        return lrc
    return _fetch_lrclib(title, artist)
