# -*- coding: utf-8 -*-
"""生成演示种子音乐（合成旋律 WAV）到 music_library/
用于验证曲库扫描与播放功能，正式使用时可删除并放入真实音乐。
"""
import wave
from pathlib import Path

import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parent.parent / "music_library"


def note(freq, dur, vol=0.5):
    t = np.linspace(0, dur, int(SR * dur), False)
    env = np.exp(-t * 3)
    # 基音 + 二次泛音，模拟简单的琴音
    wav = (np.sin(2 * np.pi * freq * t)
           + 0.5 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 6))
    return (wav * env * vol).astype(np.float32)


def seq(notes, gap=0.06, beat=0.4):
    """按音符序列生成带停顿的旋律"""
    chunks = []
    for f in notes:
        chunks.append(note(f, beat))
        chunks.append(np.zeros(int(SR * gap)))
    return np.concatenate(chunks)


def save(name, data):
    p = OUT / name
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype(np.int16).tobytes())
    print(f"  生成 {name} ({len(data)/SR:.1f}s)")


def freq(semi):  # 音名 -> 频率（A4=69）
    return 440.0 * 2 ** ((semi - 69) / 12)


C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5 = [freq(s) for s in (60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79)]
A3, B3, G3, E3 = freq(57), freq(59), freq(55), freq(52)

OUT.mkdir(parents=True, exist_ok=True)

# 1. 欢快（大调上行）
save("demo_cheerful.wav", seq([C4, E4, G4, C5, G4, E4, F4, A4, C5, A4, F4, G4, E4, C4], beat=0.3))

# 2. 平静（慢速下行）
save("demo_calm.wav", seq([E4, C4, A3, C4, G3, A3, B3, G3, E3, G3, A3, E4], beat=0.55))

# 3. 活力（快速琶音）
save("demo_energetic.wav", seq([C4, E4, G4, C5, E5, C5, G4, E4, D4, F4, A4, D5, F5, D5, A4, F4, G4, B4, D5, G5, D5, B4, G4, E4], beat=0.18, gap=0.03))

print(f"完成！共 3 首演示曲写入 {OUT}")
