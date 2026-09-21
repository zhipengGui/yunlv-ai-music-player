# -*- coding: utf-8 -*-
"""歌词格式兼容层（板块4 扩展）

网易云等平台下载的 .lrc 文件实际是 JSON 逐行歌词：
    {"t":1234,"c":[{"tx":"原词"},{"tx":"翻译"}]}
本模块按行自动转换：JSON 行 -> 标准 [mm:ss.xx] LRC 行，普通 LRC 行原样保留。
"""
import json
import re

# 元信息行前缀（作词/作曲等）：与名字合并为一行，避免误判为"原词+翻译"
_META_RE = re.compile(
    r"^(作词|作曲|编曲|制作|原唱|监制|吉他|贝斯|鼓手|录音|混音|母带|和声|发行|出品|OP|SP|词|曲|改编|翻唱|演唱|制作人|艺人)[:：]?$"
)


def _fmt_ts(ms):
    """毫秒 -> [mm:ss.xx]"""
    ms = max(0, int(ms))
    m = ms // 60000
    s = (ms % 60000) // 1000
    cent = (ms % 1000) // 10
    return "[{:02d}:{:02d}.{:02d}]".format(m, s, cent)


def _json_line_to_lrc(line):
    """单行网易云 JSON 歌词 -> 标准 LRC 行；无法解析返回 None"""
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict) or "c" not in obj:
        return None
    chunks = obj.get("c", [])
    texts = [c.get("tx", "").strip() for c in chunks if isinstance(c, dict)]
    texts = [tx for tx in texts if tx]
    if not texts:
        return None
    ts = _fmt_ts(obj.get("t", 0))
    # 富文本（含链接 li/or 字段，如"作词: XX / XX"）-> 拼接为一行
    is_rich = any(isinstance(c, dict) and (c.get("li") or c.get("or")) for c in chunks)
    if is_rich:
        return [ts + "".join(texts)]
    # 恰好 2 个元素且首元素不是元信息前缀 -> 视为"原词+翻译"分行
    if len(texts) == 2 and not _META_RE.match(texts[0]):
        return [ts + texts[0], ts + texts[1]]
    # 其余（元信息行 / 单行歌词）拼接为一行
    return [ts + "".join(texts)]


def normalize(text):
    """任意歌词文本 -> 标准 LRC 文本

    - 纯标准 LRC / TXT：原样返回
    - 含网易云 JSON 行：JSON 行转换为 [mm:ss.xx] 格式，其余行保留
    - 空内容返回空串
    """
    if not text or not text.strip():
        return ""
    out = []
    converted_any = False
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("{"):
            rows = _json_line_to_lrc(line)
            if rows:
                converted_any = True
                out.extend(rows)
                continue
        out.append(line)
    if not converted_any:
        return text
    return "\n".join(out)
