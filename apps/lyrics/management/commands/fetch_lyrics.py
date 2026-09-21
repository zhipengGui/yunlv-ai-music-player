# -*- coding: utf-8 -*-
"""批量获取本地歌曲在线歌词并缓存为 .lrc 文件

用法：
    python manage.py fetch_lyrics                 # 全部
    python manage.py fetch_lyrics --sleep 1       # 更慢，更不容易被限流
    python manage.py fetch_lyrics --limit 10      # 只处理前 10 首（调试）
"""
import time
from pathlib import Path

from django.core.management.base import BaseCommand

from lyrics.lrc_utils import normalize
from lyrics.netease import fetch_lrc
from music.models import Song


class Command(BaseCommand):
    help = "批量获取本地歌曲的在线歌词并缓存为 .lrc 文件"

    def add_arguments(self, parser):
        parser.add_argument("--sleep", type=float, default=0.5,
                            help="每首歌间隔秒数，避免触发网易云频率限制（默认 0.5）")
        parser.add_argument("--limit", type=int, default=0,
                            help="只处理前 N 首（调试用），0 表示全部")

    def handle(self, *args, **options):
        sleep = options["sleep"]
        limit = options["limit"]

        # 待处理：本地歌曲 + 未尝试过在线获取 + 当前没有 .lrc 文件
        todo = []
        for s in Song.objects.filter(source="local", lyrics_fetched=False):
            if not s.file_path:
                continue
            if not Path(s.file_path).with_suffix(".lrc").exists():
                todo.append(s)
        if limit:
            todo = todo[:limit]

        total = len(todo)
        self.stdout.write(f"待获取歌词: {total} 首（每首间隔 {sleep}s）")
        if total == 0:
            self.stdout.write(self.style.SUCCESS("没有需要获取的歌曲"))
            return

        ok = 0
        t0 = time.time()
        for i, s in enumerate(todo, 1):
            try:
                lrc = normalize(fetch_lrc(s.title, s.artist or ""))
            except Exception:
                lrc = ""
            saved = False
            if lrc:
                try:
                    Path(s.file_path).with_suffix(".lrc").write_text(lrc, encoding="utf-8")
                    saved = True
                    ok += 1
                except Exception:
                    pass
            Song.objects.filter(id=s.id).update(lyrics_fetched=True)
            self.stdout.write(
                f"[{i}/{total}] {'OK' if saved else '--'} {s.title} - {s.artist}"
            )
            if i < total:
                time.sleep(sleep)

        cost = int(time.time() - t0)
        self.stdout.write(self.style.SUCCESS(
            f"完成: 成功 {ok}/{total}，耗时 {cost // 60}分{cost % 60}秒"
        ))
