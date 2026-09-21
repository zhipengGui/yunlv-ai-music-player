# -*- coding: utf-8 -*-
"""按歌词 + 歌名 AI 重打情绪标签（修复扫描时"无 genre 一律标 happy"的误标）

用法：
    python manage.py retag_songs                 # 全部本地歌（跳过演示曲）
    python manage.py retag_songs --only-untagged # 只处理 tags 为空的歌（增量打标，推荐）
    python manage.py retag_songs --ids 1,2,3     # 只处理指定 id
    python manage.py retag_songs --limit 5       # 只处理前 5 首（调试）
    python manage.py retag_songs --dry-run       # 只预览不改库
    python manage.py retag_songs --include-demo  # 连演示曲一起处理
    python manage.py retag_songs --workers 1     # 串行（更慢但更不容易被限流）

流程：读本地 .lrc（无则在线抓歌词）→ 智谱 GLM 按歌词判定情绪 → 写回 tags
无歌词 / AI 失败时退回关键词规则兜底，保证每首歌都有合理标签。
核心逻辑在 apps/music/retagger.py，与扫描后自动打标共用。
"""
from django.core.management.base import BaseCommand

from music.models import Song
from music.retagger import retag_songs_for


class Command(BaseCommand):
    help = "按歌词 + 歌名用 AI 重新判定本地歌曲的情绪标签"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=0,
                            help="只处理前 N 首（调试用），0 表示全部")
        parser.add_argument("--dry-run", action="store_true",
                            help="只预览分类结果，不写库")
        parser.add_argument("--include-demo", action="store_true",
                            help="连内置演示曲一起处理（默认跳过）")
        parser.add_argument("--workers", type=int, default=3,
                            help="并发数（默认 3，太大可能被歌词源限流）")
        parser.add_argument("--only-untagged", action="store_true",
                            help="只处理 tags 为空的歌曲（增量打标，不动已打标的歌）")
        parser.add_argument("--ids", type=str, default="",
                            help="只处理指定歌曲 id，逗号分隔，如 101,102,103")

    def handle(self, *args, **options):
        limit = options["limit"]
        dry_run = options["dry_run"]
        include_demo = options["include_demo"]
        workers = options["workers"]
        only_untagged = options["only_untagged"]
        ids_str = (options["ids"] or "").strip()

        qs = Song.objects.filter(source="local")
        if not include_demo:
            qs = qs.exclude(file_path__icontains="demo")
        if only_untagged:
            qs = qs.filter(tags="")
        if ids_str:
            ids = [int(x) for x in ids_str.split(",") if x.strip().isdigit()]
            qs = qs.filter(id__in=ids)
        todo = list(qs.order_by("id"))
        if limit:
            todo = todo[:limit]

        total = len(todo)
        self.stdout.write(
            f"待打标: {total} 首（并发 {workers}，dry_run={dry_run}，"
            f"only_untagged={only_untagged}）"
        )
        if total == 0:
            self.stdout.write(self.style.SUCCESS("没有需要处理的歌曲"))
            return

        ids = [s.id for s in todo]

        def _cb(done, n, song, new_tags, new_genre, lyric_len):
            self.stdout.write(
                f"[{done}/{n}] {song.title} - {song.artist} "
                f"-> [{new_tags}] genre={new_genre or '-'} "
                f"(歌词{lyric_len}字)"
            )

        res = retag_songs_for(ids, workers=workers, dry_run=dry_run, progress_cb=_cb)

        tag_stat = res["tag_stat"]
        top = sorted(tag_stat.items(), key=lambda x: -x[1])[:8]
        self.stdout.write(self.style.SUCCESS(
            f"完成: 处理 {res['processed']} 首，标签变更 {res['changed']} 首，"
            f"失败 {res['failed']} 首，耗时 {res['cost'] // 60}分{res['cost'] % 60}秒"
        ))
        self.stdout.write("标签分布 Top8: " + ", ".join(f"{k or '(空)'}×{v}" for k, v in top))
