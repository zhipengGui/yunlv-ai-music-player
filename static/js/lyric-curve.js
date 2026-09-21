/* ========== 歌词情绪曲线（B方案） ==========
 * - 逐句情绪分析：歌词加载后把每行文本发往后端 /api/lyrics/analyze/
 *   （后端 AI 分析失败自动回退本地 12 情绪规则引擎），返回 [{index, emotion, score}]
 * - canvas 绘制：横轴按歌词时间分布、纵轴情绪强度（score），
 *   情绪色带 + 平滑曲线 + 情绪着色数据点 + 当前播放行发光游标与情绪标签
 * - 联动：lyrics.js 加载完成 dispatch `lyricloaded` 事件；播放时监听 timeupdate 更新游标
 * - 后端不可用 / 无歌词时前端本地兜底，保证曲线区始终有内容
 */
(() => {
"use strict";

const canvas = document.getElementById("lyric-curve");
if (!canvas) return;
const ctx = canvas.getContext("2d");

// 12 情绪标签 -> 颜色 / 中文名（与海报模块 EMOTION_COLORS 同源配色）
const EMOTION_COLORS = {
    happy: "#f6d365", sad: "#5c7cfa", relaxing: "#56ab2f", energetic: "#f83600",
    calm: "#74ebd5", romantic: "#f093fb", nostalgic: "#d4a373", focused: "#9aa4b2",
    tired: "#8a8f98", angry: "#ff5252", lonely: "#7c6bc0", cheerful: "#ffd200",
};
const EMOTION_NAMES = {
    happy: "开心", sad: "伤感", relaxing: "放松", energetic: "激昂",
    calm: "宁静", romantic: "浪漫", nostalgic: "怀旧", focused: "专注",
    tired: "疲惫", angry: "愤怒", lonely: "孤独", cheerful: "欢快",
};

let points = [];        // [{index, time, emotion, score}]
let currentIdx = -1;    // 当前播放歌词行
let loading = false;

function colorOf(emotion) { return EMOTION_COLORS[emotion] || "#9aa4b2"; }

/* ---------- 画布适配（高分屏） ---------- */
function fit() {
    const r = canvas.getBoundingClientRect();
    // 面板未显示时保持原尺寸，避免把画布置成 0×0（曲线丢失的根因）
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", () => { fit(); draw(); });
fit();

/* ---------- 绘制 ---------- */
function draw() {
    const W = canvas.clientWidth || canvas.width || 400;
    const H = canvas.clientHeight || canvas.height || 86;
    ctx.clearRect(0, 0, W, H);

    if (!points.length) {
        ctx.fillStyle = loading ? "rgba(155,155,173,0.7)" : "rgba(155,155,173,0.4)";
        ctx.font = "12px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(loading ? "正在分析歌词情绪…" : "♪ 歌词情绪曲线", W / 2, H / 2 + 4);
        return;
    }

    const padL = 10, padR = 10, padT = 16, padB = 8;
    const cw = W - padL - padR;
    const ch = H - padT - padB;
    const n = points.length;
    const t0 = points[0].time;
    const span = (points[n - 1].time - t0) || 1;

    const coords = points.map((p) => {
        const x = n <= 1 ? W / 2 : padL + ((p.time - t0) / span) * cw;
        const y = padT + (1 - p.score) * ch;
        return { x, y, emotion: p.emotion, score: p.score };
    });

    // 底部情绪色带（相邻点颜色渐变）
    for (let i = 0; i < n - 1; i++) {
        const a = coords[i], b = coords[i + 1];
        const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
        g.addColorStop(0, colorOf(a.emotion));
        g.addColorStop(1, colorOf(b.emotion));
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(a.x, H - padB, Math.max(1, b.x - a.x), 3);
    }
    ctx.globalAlpha = 1;

    // 曲线下方的淡色填充（面积图，增加层次）
    ctx.beginPath();
    coords.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(coords[n - 1].x, H - padB);
    ctx.lineTo(coords[0].x, H - padB);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    // 曲线描边
    ctx.beginPath();
    coords.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 数据点（情绪着色，当前行放大发光）
    coords.forEach((p, i) => {
        const isCur = i === currentIdx;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isCur ? 5 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = colorOf(p.emotion);
        ctx.shadowColor = colorOf(p.emotion);
        ctx.shadowBlur = isCur ? 16 : 5;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 当前播放游标：垂直虚线 + 顶部情绪标签
    if (currentIdx >= 0 && coords[currentIdx]) {
        const cur = coords[currentIdx];
        ctx.beginPath();
        ctx.moveTo(cur.x, padT - 2);
        ctx.lineTo(cur.x, H - padB + 2);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const name = EMOTION_NAMES[cur.emotion] || cur.emotion;
        ctx.font = "600 10px 'PingFang SC','Microsoft YaHei',sans-serif";
        const tw = Math.ceil(ctx.measureText(name).width) + 12;
        const bx = Math.max(0, Math.min(cur.x - tw / 2, W - tw));
        ctx.fillStyle = colorOf(cur.emotion);
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, 0, tw, 15, 7.5);
        else ctx.rect(bx, 0, tw, 15);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, bx + tw / 2, 8);
        ctx.textBaseline = "alphabetic";
    }

    // 左右刻度线
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB);
    ctx.moveTo(W - padR, padT); ctx.lineTo(W - padR, H - padB);
    ctx.stroke();
}

/* ---------- 数据加载 ---------- */
async function loadCurve() {
    const lines = (window.lyricLines && window.lyricLines()) || [];
    points = [];
    currentIdx = -1;
    fit(); // 确保面板已展开时按真实尺寸绘制
    if (lines.length < 2) { draw(); return; }

    loading = true;
    draw();
    const song = (window.player && window.player.currentSong) || {};
    try {
        const d = await API.post("/api/lyrics/analyze/", {
            lines: lines.map((l) => l.text),
            title: song.title || "",
            artist: song.artist || "",
        });
        if (!d || !Array.isArray(d.emotions)) throw new Error("invalid");
        points = lines.map((l, i) => {
            const e = d.emotions[i] || {};
            return {
                index: i,
                time: l.time,
                emotion: EMOTION_COLORS[e.emotion] ? e.emotion : "relaxing",
                score: typeof e.score === "number" ? Math.max(0, Math.min(1, e.score)) : 0.4,
            };
        });
    } catch (e) {
        // 后端不可用 → 本地轻量规则兜底，曲线照常显示
        points = lines.map((l, i) => localFallback(l.text, i, l.time));
    } finally {
        loading = false;
        fit(); // 数据就绪后按当前面板实际尺寸重绘
        draw();
    }
}

/* 本地兜底：高频情绪关键词粗判（仅在后端不可用时启用） */
const LOCAL_RULES = [
    { emotion: "sad", words: ["泪", "哭", "心碎", "难过", "悲伤", "离别", "失去", "再见", "遗憾", "想念", "分手"] },
    { emotion: "angry", words: ["愤怒", "恨", "讨厌", "气", "发疯"] },
    { emotion: "lonely", words: ["孤独", "寂寞", "一个人", "独自"] },
    { emotion: "romantic", words: ["爱", "恋", "喜欢你", "我爱你", "拥抱", "吻"] },
    { emotion: "happy", words: ["开心", "快乐", "笑", "阳光", "幸福", "跳舞"] },
    { emotion: "energetic", words: ["奔跑", "飞翔", "自由", "梦想", "热血", "燃烧"] },
    { emotion: "nostalgic", words: ["回忆", "怀念", "从前", "时光"] },
    { emotion: "tired", words: ["累", "疲惫", "困"] },
    { emotion: "calm", words: ["月光", "星空", "晚安", "宁静", "安静"] },
    { emotion: "relaxing", words: ["放松", "微风", "温柔", "舒缓", "平静"] },
];
function localFallback(text, index, time) {
    for (const r of LOCAL_RULES) {
        if (r.words.some((w) => text.includes(w))) {
            return { index, time, emotion: r.emotion, score: 0.7 };
        }
    }
    return { index, time, emotion: "relaxing", score: 0.4 };
}

/* ---------- 事件绑定 ---------- */
document.addEventListener("DOMContentLoaded", () => {
    // 切歌：先清空曲线（等 lyrics.js 加载完新歌词后由 lyricloaded 重新填充）
    window.addEventListener("songchange", () => {
        points = [];
        currentIdx = -1;
        loading = false;
        fit();
        draw();
    });
    // lyrics.js 歌词解析完成 -> 触发情绪分析
    document.addEventListener("lyricloaded", loadCurve);
    // 面板展开（手动点按钮等）-> 按实际尺寸重绘
    document.addEventListener("lyricpanelopen", () => { fit(); draw(); });

    // 播放进度 -> 更新游标
    const audio = window.player && window.player.audio;
    if (audio) {
        audio.addEventListener("timeupdate", () => {
            const idx = (window.currentLyricIndex && window.currentLyricIndex()) ?? -1;
            if (idx >= 0 && idx < points.length && idx !== currentIdx) {
                currentIdx = idx;
                draw();
            }
        });
    }
});
})();
