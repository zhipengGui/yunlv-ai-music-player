# -*- coding: utf-8 -*-
"""AI 情绪分析服务（板块6 核心）
- 调用智谱 GLM-4-Flash（免费）分析心情文本 → 结构化标签
- 密钥从环境变量 ZHIPU_API_KEY 读取（不写死在代码里）
- 服务不可用 / 无法识别时：降级到关键词规则兜底，保证功能可用

可升级性：后续换其他大模型（DeepSeek / 文心等）只需替换本文件的请求部分
"""
import json
import os
import re

import requests

ZHIPU_BASE = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
ZHIPU_MODEL = "glm-4-flash"

# 情绪标签 / 曲风词表（与 music/models.py 保持一致）
MOOD_TAGS = ["happy", "sad", "relaxing", "energetic", "calm", "romantic",
             "nostalgic", "focused", "tired", "angry", "lonely", "cheerful"]
GENRES = ["pop", "rock", "electronic", "hiphop", "rnb", "instrumental",
          "classical", "jazz", "folk", "acoustic", "lofi", "ambient"]

SYSTEM_PROMPT = f"""你是专业的音乐推荐助手。用户会输入一句心情或场景描述，你需要：
1. 准确分析用户当前的情绪状态
2. 从下面的情绪标签中选择最匹配的 1-3 个
   情绪标签: {", ".join(MOOD_TAGS)}
3. 从下面的曲风中选择最匹配的 1-2 个（纯音乐场景优先选 instrumental 或 ambient）
   曲风: {", ".join(GENRES)}
4. 只输出一个 JSON 对象，不要任何多余文字，格式：
{{"emotions": ["tired"], "tags": ["relaxing"], "genres": ["instrumental"], "description": "一句话说明推荐方向，语气温和"}}"""

# 多轮追问时的补充指令：用户可能是在上一轮推荐基础上反馈/追问
CONVERSATION_PROMPT = f"""上面的对话是用户上一次点歌的结果。现在用户可能是在追问或调整，比如：
- 「再放松一点」→ 调整情绪/曲风，让推荐更放松
- 「换几首」→ 保持需求不变，重新推荐不同的歌
- 「不要纯音乐」→ 在 genres 中排除 instrumental
- 「来点中文的」→ 优先选择国内流行/民谣等
请结合前文理解用户新需求，重新输出一套推荐参数（格式不变）。若是全新提问则直接分析。"""


def analyze_mood(text, history=None):
    """分析心情文本，返回结构化结果（任何情况下都有兜底返回）

    history: [{"role": "user"|"assistant", "content": str}, ...]
             最近几轮对话，供"多轮追问"理解上下文；空则按新会话处理
    """
    try:
        return _call_llm(text, history)
    except Exception:
        return _rule_fallback(text)


def _call_llm(text, history=None):
    """调用智谱 GLM（支持多轮历史）"""
    api_key = os.environ.get("ZHIPU_API_KEY", "")
    if not api_key:
        return _rule_fallback(text)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        # 只保留最近 6 条历史，控制 token
        messages.append({"role": "system", "content": CONVERSATION_PROMPT})
        messages.extend(history[-6:])
    messages.append({"role": "user", "content": text})

    resp = requests.post(
        ZHIPU_BASE,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": ZHIPU_MODEL,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 300,
        },
        timeout=30,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    data = _extract_json(content)
    return _normalize(data, text)


def _extract_json(content):
    """从模型输出中提取 JSON（兼容 markdown 代码块）"""
    m = re.search(r"\{.*\}", content, re.S)
    if m:
        return json.loads(m.group(0))
    return {}


def _normalize(data, text):
    """规范化模型输出，保证字段完整、词表合法"""
    tags = [t for t in data.get("tags", []) if t in MOOD_TAGS][:3]
    genres = [g for g in data.get("genres", []) if g in GENRES][:2]
    emotions = [e for e in data.get("emotions", []) if e in MOOD_TAGS][:3]
    description = data.get("description", "").strip()

    # 模型输出异常时的规则兜底
    if not tags and not genres:
        return _rule_fallback(text)
    return {
        "emotions": emotions or tags,
        "tags": tags,
        "genres": genres,
        "description": description or "为你挑选了几首合适氛围的歌曲",
        "ai": True,
    }


def _rule_fallback(text):
    """关键词规则兜底（AI 不可用或无法识别时）"""
    text = text.lower()
    rules = [
        (["累", "加班", "疲惫", "困", "tired", "exhausted"], ["tired"], ["relaxing"], ["instrumental", "lofi"], "辛苦啦，来几首舒缓的纯音乐放松一下吧"),
        (["难过", "哭", "伤心", "sad", "unhappy"], ["sad"], ["calm"], ["folk", "acoustic"], "抱抱你，让温柔的音乐陪着你"),
        (["开心", "兴奋", "happy", "excited"], ["happy"], ["cheerful"], ["pop"], "心情这么好，来点轻快的歌一起开心吧"),
        (["生气", "愤怒", "烦", "angry", "mad"], ["angry"], ["energetic"], ["rock"], "把不爽都释放出来吧"),
        (["孤独", "寂寞", "lonely"], ["lonely"], ["calm"], ["ambient"], "你不是一个人，让音乐陪着你"),
        (["恋爱", "喜欢", "浪漫", "love", "romantic"], ["romantic"], ["romantic"], ["rnb", "jazz"], "甜甜的氛围歌单来啦"),
        (["专注", "学习", "工作", "写作业", "focus"], ["focused"], ["focused"], ["lofi", "instrumental"], "进入心流状态，专注歌单送上"),
        (["睡", "失眠", "安静", "平静", "calm"], ["calm"], ["calm"], ["ambient", "classical"], "安静下来，让音乐伴你入眠"),
    ]
    for keywords, emotions, tags, genres, desc in rules:
        if any(k in text for k in keywords):
            return {
                "emotions": emotions, "tags": tags, "genres": genres,
                "description": desc, "ai": False,
            }
    # 完全无法识别 → 兜底热门治愈
    return {
        "emotions": [], "tags": ["relaxing"], "genres": ["instrumental"],
        "description": "没完全理解你的心情，先给你准备了一份治愈歌单", "ai": False,
    }


# ================== 歌曲情绪分类（retag_songs 使用） ==================

SONG_SYSTEM_PROMPT = f"""你是资深音乐编辑。根据歌曲的【歌名、歌手、歌词片段】判断这首歌带给听众的主要情绪。

要求：
1. 从下面的情绪标签中选择最匹配的 1-3 个（按贴合度从高到低排列）
   情绪标签: {", ".join(MOOD_TAGS)}
2. 从下面的曲风中选择最匹配的 1 个；纯器乐/无人声选 instrumental，拿不准选最接近的
   曲风: {", ".join(GENRES)}
3. 判断必须忠实于歌词内容。歌词出现「泪、哭、心痛、离别、失去、回忆、一个人」等字眼时，如实标为 sad / nostalgic / lonely，绝不能因为旋律未知或歌名看似积极就一律标 happy
4. 只输出一个 JSON 对象，不要任何多余文字，格式：
{{"tags": ["sad", "nostalgic"], "genre": "folk"}}"""


def classify_song(title, artist, lyric):
    """按 歌名+歌手+歌词 判定歌曲情绪标签（任何情况都有兜底返回）

    返回: {"tags": [...], "genre": "..."}
    """
    try:
        return _call_llm_classify(title, artist, lyric)
    except Exception:
        return _rule_fallback_song(title, artist, lyric)


def _call_llm_classify(title, artist, lyric):
    api_key = os.environ.get("ZHIPU_API_KEY", "")
    if not api_key:
        return _rule_fallback_song(title, artist, lyric)

    user = f"歌名：{title}\n歌手：{artist or '未知'}\n歌词片段：\n{lyric[:800] or '（无歌词，请仅凭歌名与歌手判断）'}"
    resp = requests.post(
        ZHIPU_BASE,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": ZHIPU_MODEL,
            "messages": [
                {"role": "system", "content": SONG_SYSTEM_PROMPT},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": 200,
        },
        timeout=30,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    data = _extract_json(content)
    tags = [t for t in data.get("tags", []) if t in MOOD_TAGS][:3]
    genre = data.get("genre", "") if data.get("genre") in GENRES else ""
    if not tags:
        return _rule_fallback_song(title, artist, lyric)
    return {"tags": tags, "genre": genre}


def _extract_lyric_text(lyric):
    """从 LRC 歌词中提取纯文本（去掉 [mm:ss.xx] 时间轴），取前 400 字"""
    lines = []
    for line in (lyric or "").splitlines():
        line = re.sub(r"\[[^\]]*\]", "", line).strip()
        if line:
            lines.append(line)
    text = " ".join(lines)
    return text[:400]


def _rule_fallback_song(title, artist, lyric):
    """歌词/歌名关键词规则兜底（AI 不可用时仍能给出合理标签）"""
    text = _extract_lyric_text(lyric)
    hay = f"{title} {artist or ''} {text}".lower()

    # 悲伤信号强于一切（避免把伤感歌误标成 happy）
    sad_words = ["泪", "哭", "心痛", "心碎", "难过", "悲伤", "离别", "离开",
                 "分手", "失去", "再见", "回忆", "怀念", "独自", "一个人",
                 "寂寞", "伤痕", "破碎", "遗憾", "想念", "想哭"]
    if any(w in hay for w in sad_words):
        return {"tags": ["sad", "nostalgic"], "genre": ""}

    love_words = ["爱", "恋", "喜欢你", "我爱你", "心上人", "牵手", "拥抱", "吻"]
    if any(w in hay for w in love_words):
        return {"tags": ["romantic"], "genre": ""}

    joy_words = ["开心", "快乐", "笑", "阳光", "跳舞", "歌唱", "幸福", "甜蜜", "一起玩"]
    if any(w in hay for w in joy_words):
        return {"tags": ["cheerful", "happy"], "genre": ""}

    energy_words = ["奔跑", "飞翔", "自由", "梦想", "奋斗", "热血", "燃烧", "征服", "冲"]
    if any(w in hay for w in energy_words):
        return {"tags": ["energetic"], "genre": ""}

    calm_words = ["星空", "微风", "晚安", "月光", "安静", "宁静", "湖畔", "森林", "细雨"]
    if any(w in hay for w in calm_words):
        return {"tags": ["calm", "relaxing"], "genre": ""}

    # 无歌词 / 无信号 → 中性标签（不预设开心，避免二次误标）
    return {"tags": ["relaxing", "calm"], "genre": ""}


# ================== 歌词逐句情绪分析（歌词情绪曲线使用） ==================

LYRIC_SYSTEM_PROMPT = f"""你是专业的歌词情感分析师。下面是一首歌的逐句歌词，每行格式为 [编号] 歌词文本。请逐句分析每一句歌词带给听众的主要情绪。

要求：
1. 每句歌词只能从下面 12 个情绪标签中选择最匹配的 1 个：
   {", ".join(MOOD_TAGS)}
2. 为每个情绪给出强度分数：0 到 1 之间的小数（0.8 表示情绪很强烈，0.3 表示很淡）
3. 分析必须忠实于歌词内容：出现「泪、哭、心碎、离别、失去、一个人」等字眼时标 sad/lonely，出现「爱、吻、牵手」标 romantic，出现「奔跑、燃烧、热血」标 energetic
4. 拿不准的句子标 relaxing 或 calm，不要编造情绪
5. 输出必须与输入的每行一一对应，只输出一个 JSON 数组，不要任何多余文字，格式：
[{{"index": 0, "emotion": "sad", "score": 0.8}}, {{"index": 1, "emotion": "calm", "score": 0.5}}]"""

# 12 情绪关键词权重表（规则兜底）：词命中权重高则情绪更强
LYRIC_EMOTION_RULES = [
    ("angry", 1.2, ["愤怒", "恨", "讨厌", "气死", "发疯", "不满", "发火", "燃烧"]),
    ("sad", 1.2, ["泪", "哭", "心碎", "难过", "悲伤", "离别", "失去", "说了再见",
                  "遗憾", "想念", "想哭", "心痛", "伤口", "分手", "破碎", "埋葬", "离开"]),
    ("lonely", 1.0, ["孤独", "寂寞", "一个人", "独自", "没人", "空荡", "孤单"]),
    ("nostalgic", 1.0, ["回忆", "怀念", "从前", "小时候", "老照片", "那年", "时光", "旧"]),
    ("tired", 1.0, ["累", "疲惫", "困", "熬夜", "乏"]),
    ("romantic", 1.0, ["爱", "恋", "喜欢你", "我爱你", "心上人", "牵手", "拥抱", "吻", "甜蜜"]),
    ("energetic", 0.9, ["奔跑", "飞翔", "自由", "梦想", "热血", "征服", "呐喊", "出发", "燃烧"]),
    ("happy", 0.9, ["开心", "快乐", "笑", "阳光", "跳舞", "幸福", "欢快", "美好"]),
    ("cheerful", 0.8, ["啦啦", "嘿", "耶", "跳跃", "活泼", "闪耀", "光芒"]),
    ("focused", 0.8, ["专注", "努力", "坚持", "目标", "奋斗", "前进", "清醒"]),
    ("relaxing", 0.7, ["放松", "安静", "微风", "温柔", "舒缓", "平静", "治愈"]),
    ("calm", 0.7, ["月光", "星空", "晚安", "宁静", "湖畔", "森林", "细雨", "沉睡", "黑夜"]),
]


def analyze_lyric_emotions(lines, title="", artist=""):
    """逐句分析歌词情绪，返回 [{index, emotion, score}]（任何情况都有兜底）
    lines: [{"index": 行号0起, "text": 歌词文本}]
    - 行数 <= 1 或 > 60 时直接走规则引擎（LLM 批量输出不稳定）
    - LLM 返回行数不足输入的 70% 时整体回退规则引擎
    """
    if not lines:
        return []
    if len(lines) <= 1:
        return [_rule_line(l) for l in lines]
    if len(lines) > 60:
        return [_rule_line(l) for l in lines]
    try:
        result = _call_llm_lyric(lines, title, artist)
        if result is not None and len(result) >= max(1, int(len(lines) * 0.7)):
            return result
    except Exception:
        pass
    return [_rule_line(l) for l in lines]


def _call_llm_lyric(lines, title, artist):
    """调用 LLM 批量分析每句歌词情绪，失败返回 None（由调用方回退规则引擎）"""
    api_key = os.environ.get("ZHIPU_API_KEY", "")
    if not api_key:
        return None

    user = f"歌曲：{title or '未知'} {artist or ''}\n歌词：\n" + "\n".join(
        f"[{l['index']}] {l['text']}" for l in lines)
    resp = requests.post(
        ZHIPU_BASE,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": ZHIPU_MODEL,
            "messages": [
                {"role": "system", "content": LYRIC_SYSTEM_PROMPT},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": 1500,
        },
        timeout=45,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    data = _extract_json_array(content)
    return _normalize_lyric_result(data, lines)


def _extract_json_array(content):
    """从模型输出中提取 JSON 数组（兼容 markdown 代码块 / 括号包裹）"""
    m = re.search(r"\[.*\]", content, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return []
    return []


def _normalize_lyric_result(data, lines):
    """规范化模型输出：按 index 对齐输入行，非法情绪归 relaxing，缺失行继承前一句"""
    by_index = {}
    for item in data:
        try:
            idx = int(item.get("index", -1))
            if idx < 0:
                continue
            emotion = item.get("emotion", "")
            if emotion not in MOOD_TAGS:
                emotion = "relaxing"
            score = float(item.get("score", 0.5))
            score = max(0.0, min(1.0, score))
            by_index[idx] = {"emotion": emotion, "score": score}
        except Exception:
            continue

    result = []
    prev = {"emotion": "relaxing", "score": 0.4}
    for l in lines:
        idx = l["index"]
        item = by_index.get(idx)
        if item is None:
            item = dict(prev)  # 缺行取前一句情绪
        else:
            prev = item
        result.append({"index": idx, "emotion": item["emotion"], "score": item["score"]})
    return result


def _rule_line(line):
    """单行歌词规则打分：命中关键词取最高权重情绪，未命中取中性 relaxing"""
    text = (line.get("text") or "").strip()
    idx = line.get("index", 0)
    if not text:
        return {"index": idx, "emotion": "relaxing", "score": 0.4}
    hay = text.lower()
    best = None
    for emotion, weight, words in LYRIC_EMOTION_RULES:
        hits = [w for w in words if w in hay]
        if hits:
            # 命中词越多，情绪强度越高
            w = weight * (1 + 0.1 * len(hits))
            if best is None or w > best[0]:
                best = (w, emotion)
    if best is None:
        return {"index": idx, "emotion": "relaxing", "score": 0.4}
    score = min(0.95, 0.5 + 0.15 * best[0])
    return {"index": idx, "emotion": best[1], "score": round(score, 2)}
