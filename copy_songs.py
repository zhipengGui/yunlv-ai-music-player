# -*- coding: utf-8 -*-
"""一键收集分散文件夹中的歌曲到 music_library

用法：
    python copy_songs.py "源文件夹路径" ["目标文件夹路径"]

功能：
- 递归搜索源文件夹下所有音频文件（mp3/flac/wav/m4a/aac/ogg/wma/opus）
- 连同同名歌词（.lrc / .txt）一起复制
- 重名自动加序号，如 "xxx (1).mp3"
- 只复制不移动，源文件保持不变
- 不提供目标路径时，默认复制到脚本所在目录下的 music_library
"""
import os
import shutil
import sys

AUDIO_EXTS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma", ".opus"}
LYRIC_EXTS = {".lrc", ".txt"}

TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music_library")


def unique_path(target, name):
    """重名自动加序号：xxx.mp3 -> xxx (1).mp3；返回 (最终路径, 序号后缀)"""
    stem, ext = os.path.splitext(name)
    if not os.path.exists(os.path.join(target, name)):
        return os.path.join(target, name), ""
    n = 1
    while True:
        suffix = f" ({n})"
        cand = os.path.join(target, f"{stem}{suffix}{ext}")
        if not os.path.exists(cand):
            return cand, suffix
        n += 1


def collect(src_root):
    """收集源目录下所有 [音频路径, 相关歌词路径] 对"""
    items = []
    for root, dirs, files in os.walk(src_root):
        # 跳过隐藏文件夹
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            stem, ext = os.path.splitext(f)
            if ext.lower() not in AUDIO_EXTS:
                continue
            audio = os.path.join(root, f)
            lrc = ""
            for lext in LYRIC_EXTS:
                cand = os.path.join(root, stem + lext)
                if os.path.exists(cand):
                    lrc = cand
                    break
            items.append((audio, lrc))
    return items


def main():
    if len(sys.argv) < 2:
        print("用法: python copy_songs.py \"源文件夹路径\" [\"目标文件夹路径\"]")
        sys.exit(1)

    src_root = os.path.abspath(sys.argv[1])
    target = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else TARGET
    if not os.path.isdir(src_root):
        print(f"错误：找不到文件夹 {src_root}")
        sys.exit(1)
    if os.path.abspath(src_root) == target:
        print("源文件夹与目标相同，无需复制")
        sys.exit(1)

    os.makedirs(target, exist_ok=True)
    items = collect(src_root)
    if not items:
        print(f"在 {src_root} 下没有找到音频文件")
        sys.exit(0)

    print(f"找到音频 {len(items)} 首，开始复制到 {target} ...")
    copied = lyrics = 0
    for audio, lrc in items:
        name = os.path.basename(audio)
        dest, suffix = unique_path(target, name)
        try:
            shutil.copy2(audio, dest)
            copied += 1
        except Exception as e:
            print(f"  失败: {name} -> {e}")
            continue
        if lrc:
            lname = os.path.basename(lrc)
            lstem, lext = os.path.splitext(lname)
            ldest = os.path.join(target, f"{lstem}{suffix}{lext}" if suffix else lname)
            if os.path.exists(ldest):
                ldest, _ = unique_path(target, lname)
            try:
                shutil.copy2(lrc, ldest)
                lyrics += 1
            except Exception:
                pass
        print(f"  [{copied}/{len(items)}] {name}")

    print(f"\n完成：复制歌曲 {copied} 首，歌词 {lyrics} 份")
    print("接下来在页面点「重新扫描曲库」即可加载")


if __name__ == "__main__":
    main()
