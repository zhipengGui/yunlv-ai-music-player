# -*- coding: utf-8 -*-
"""云律 AI · 内置演示曲（离线合成，无需任何音乐文件）

12 首演示曲通过 numpy 实时合成 WAV 生成到 music_library/demo/ 目录，
保证播放器即使没有真实 MP3 也能开箱即听；同时演示曲带风格/情绪标签，
可参与搜索、拼音检索、情绪点歌与推荐。

合成器说明：
- 旋律/低音/鼓组全部由 numpy 向量化生成，采样率 44100 单声道 16bit
- 每首约 20~35 秒，按 tempo 与情绪骨架差异化生成
"""
import os
from pathlib import Path

import numpy as np

from django.conf import settings

SR = 44100

# ---------------------------------------------------------------------------
# 旋律骨架（16 个八分音符槽 = 2 小节，midi 编号，0 表示休止）
# ---------------------------------------------------------------------------
SKETCH = {
    "舒缓": [60, 0, 62, 0, 64, 0, 67, 0, 64, 0, 62, 0, 60, 0, 0, 0],
    "欢快": [64, 67, 72, 0, 71, 67, 64, 0, 62, 65, 69, 0, 67, 0, 62, 0],
    "动感": [60, 60, 67, 67, 72, 0, 67, 0, 64, 64, 69, 69, 74, 0, 72, 0],
    "空灵": [60, 0, 64, 0, 67, 0, 0, 0, 64, 0, 69, 0, 72, 0, 0, 0],
    "轻快": [62, 66, 69, 66, 62, 0, 66, 69, 65, 67, 69, 67, 62, 0, 60, 62],
    "爵士": [62, 0, 65, 0, 69, 0, 65, 69, 67, 0, 62, 0, 60, 0, 0, 0],
}

BASS_LINE = [48, 52, 55, 50, 48, 52, 55, 53]

# 情绪骨架 -> (genre, tags)
GENRE_TAGS = {
    "舒缓": ("instrumental", "calm,relaxing"),
    "欢快": ("pop", "happy,cheerful"),
    "动感": ("electronic", "energetic"),
    "空灵": ("ambient", "calm,focused"),
    "轻快": ("folk", "cheerful,happy"),
    "爵士": ("jazz", "relaxing,romantic"),
}

DEMO_SONGS = [
    {"id": "chenxi",   "title": "晨曦微光", "artist": "周小云", "tempo": 70,  "trans": -2, "sketch": "舒缓"},
    {"id": "xingye",   "title": "星夜漫步", "artist": "云端音社", "tempo": 60,  "trans": 0,  "sketch": "空灵"},
    {"id": "yuhou",    "title": "雨后彩虹", "artist": "林晓律", "tempo": 105, "trans": 2,  "sketch": "轻快"},
    {"id": "xiari",    "title": "夏日晴空", "artist": "周小云", "tempo": 120, "trans": 4,  "sketch": "欢快"},
    {"id": "chengshi", "title": "城市律动", "artist": "潮汐乐队", "tempo": 128, "trans": -3, "sketch": "动感"},
    {"id": "jingmi",   "title": "静谧时光", "artist": "云端音社", "tempo": 66,  "trans": 3,  "sketch": "舒缓"},
    {"id": "yunduan",  "title": "云端漫游", "artist": "林晓律", "tempo": 58,  "trans": 7,  "sketch": "空灵"},
    {"id": "weifeng",  "title": "微风拂面", "artist": "周小云", "tempo": 100, "trans": 0,  "sketch": "轻快"},
    {"id": "wuye",     "title": "午夜电台", "artist": "蓝调沙龙", "tempo": 88,  "trans": -4, "sketch": "爵士"},
    {"id": "chenguang", "title": "晨光正好", "artist": "潮汐乐队", "tempo": 116, "trans": -1, "sketch": "欢快"},
    {"id": "shenhai",  "title": "深海回声", "artist": "云端音社", "tempo": 55,  "trans": 4,  "sketch": "空灵"},
    {"id": "taqing",   "title": "踏青时光", "artist": "林晓律", "tempo": 108, "trans": -2, "sketch": "轻快"},
]

DEMO_DIR = settings.MUSIC_LIBRARY_DIR / "demo"


def midi_to_freq(m):
    return 440.0 * (2 ** ((m - 69) / 12))


def _note_wave(freq, dur, kind="piano", vel=0.9):
    n = int(SR * dur)
    if n <= 0:
        return np.zeros(0)
    t = np.arange(n) / SR
    if kind == "piano":
        w = (np.sin(2 * np.pi * freq * t)
             + 0.4 * np.sin(2 * np.pi * 2 * freq * t)
             + 0.15 * np.sin(2 * np.pi * 3 * freq * t))
        env = np.exp(-t * 5.0)
    elif kind == "pad":
        w = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * 1.005 * freq * t)
        env = np.minimum(t / 0.3, 1.0) * np.exp(-t * 1.3)
    elif kind == "bass":
        w = np.sign(np.sin(2 * np.pi * freq * t)) * 0.55 + 0.45 * np.sin(2 * np.pi * freq * t)
        env = np.minimum(t / 0.05, 1.0) * np.exp(-t * 3.2)
    else:
        w = np.sin(2 * np.pi * freq * t)
        env = np.exp(-t * 4.0)
    return w * env * vel


def _kick():
    n = int(SR * 0.16)
    t = np.arange(n) / SR
    f = 85 * np.exp(-t * 28) + 42
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t * 24)


def _hat():
    n = int(SR * 0.055)
    t = np.arange(n) / SR
    noise = np.random.uniform(-1, 1, n)
    high = np.diff(noise, prepend=0.0)
    return high * np.exp(-t * 70) * 0.25


def _snare():
    n = int(SR * 0.14)
    t = np.arange(n) / SR
    noise = np.random.uniform(-1, 1, n) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return (noise + tone) * 0.55


def synthesize(song):
    """合成整首演示曲，返回 int16 mono numpy 数组"""
    bpm = song["tempo"]
    beat = 60.0 / bpm
    slots = 4
    total_beats = 16 * slots * 0.5 + 2
    total = int(total_beats * beat * SR)
    buf = np.zeros(total)

    mel = SKETCH[song["sketch"]]
    trans = song["trans"]
    N = len(mel)

    for r in range(slots):
        for i, m in enumerate(mel):
            if m == 0:
                continue
            start_beat = (r * N + i) * 0.5
            dur = beat * (1.2 if song["sketch"] in ("空灵", "舒缓", "爵士") else 0.9)
            start = int(start_beat * beat * SR)
            w = _note_wave(midi_to_freq(m + trans), dur, "piano", 0.8)
            n = min(len(w), total - start)
            if n > 0:
                buf[start:start + n] += w[:n]

    n_bass = len(BASS_LINE)
    for r in range(slots * 2):
        m = BASS_LINE[r % n_bass] + trans - 12
        start_beat = r * 2.0
        start = int(start_beat * beat * SR)
        w = _note_wave(midi_to_freq(m), beat * 1.8, "bass", 0.55)
        n = min(len(w), total - start)
        if n > 0:
            buf[start:start + n] += w[:n]

    drum_kind = song["sketch"]
    kick_on = {"动感": [0, 2, 4, 6], "欢快": [0, 4], "轻快": [0, 4],
               "舒缓": [], "空灵": [], "爵士": [0, 4]}[drum_kind]
    snare_on = {"动感": [2, 6], "欢快": [2, 6], "轻快": [2, 6],
                "舒缓": [], "空灵": [], "爵士": [2, 6]}[drum_kind]
    hat_every = 1 if drum_kind in ("动感", "欢快", "轻快") else 2

    total_slots = int(total_beats * 2)
    for s in range(total_slots):
        beat_idx = s // 2
        start = int(s * 0.5 * beat * SR)
        if s % 2 == 0 and beat_idx % 8 in kick_on:
            w = _kick(); n = min(len(w), total - start)
            if n > 0:
                buf[start:start + n] += w[:n] * 0.9
        if s % 2 == 0 and beat_idx % 8 in snare_on:
            w = _snare(); n = min(len(w), total - start)
            if n > 0:
                buf[start:start + n] += w[:n] * 0.8
        if s % hat_every == 0:
            w = _hat(); n = min(len(w), total - start)
            if n > 0:
                buf[start:start + n] += w[:n]

    if song["sketch"] in ("空灵", "舒缓"):
        for r in range(slots):
            m = (60 + trans) % 128
            start_beat = r * 8.0
            start = int(start_beat * beat * SR)
            w = _note_wave(midi_to_freq(m), beat * 7, "pad", 0.18)
            n = min(len(w), total - start)
            if n > 0:
                buf[start:start + n] += w[:n]

    peak = np.max(np.abs(buf))
    if peak > 0:
        buf = buf / peak * 0.88
    fade = int(0.5 * SR)
    buf[:fade] *= np.linspace(0, 1, fade)
    buf[-fade:] *= np.linspace(1, 0, fade)

    return (buf * 32767).astype(np.int16)


def ensure_demo_songs():
    """确保 12 首演示曲已生成并入库，返回本次新增数量（配合扫描器使用）"""
    import wave

    from .models import Song

    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    added = 0
    for song in DEMO_SONGS:
        path = DEMO_DIR / f"{song['id']}.wav"
        if not path.exists():
            audio = synthesize(song)
            with wave.open(str(path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SR)
                wf.writeframes(audio.tobytes())

        if Song.objects.filter(file_path=str(path)).exists():
            continue
        genre, tags = GENRE_TAGS[song["sketch"]]
        duration = round(32 * 60 / song["tempo"], 1)
        Song.objects.create(
            title=song["title"],
            artist=song["artist"],
            album="云律演示曲",
            genre=genre,
            tags=tags,
            duration=duration,
            file_path=str(path),
            source="local",
        )
        added += 1
    return added
