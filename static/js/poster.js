/* ========== 板块7 歌词海报 V3（高级版） ==========
 * - 6 套模板：封面沉浸 / 极光 / 极简杂志 / 黑胶唱片 / 胶片拍立得 / 歌词海报(纯文字)
 * - 每套模板内置 3-4 个程序化艺术背景变体
 * - 视觉质感：封面模糊铺底、多层光晕、暗角、噪点颗粒、毛玻璃歌词块
 * - 内容增强：标题区、品牌水印
 * - 尺寸：竖版 9:16 / 方形 1:1，导出 2x 高清 PNG
 * - 在线封面统一走 /api/posters/cover/ 代理（同源，避免 canvas 污染导致 PNG 导出失败）
 */
(() => {
"use strict";

// ---------- 基础配色（后端 /api/posters/palette/ 会同步覆盖） ----------
let posterPalettes = {
    pop: ["#FF6B6B", "#FFD93D"],
    rock: ["#2B2D42", "#EF233C"],
    electronic: ["#4A00E0", "#8E2DE2"],
    hiphop: ["#1D976C", "#93F9B9"],
    rnb: ["#642B73", "#C6426E"],
    instrumental: ["#56CCF2", "#2F80ED"],
    classical: ["#B79891", "#94716B"],
    jazz: ["#F7971E", "#FFD200"],
    folk: ["#8E9EAB", "#EEF2F3"],
    acoustic: ["#CAC531", "#F3F9A7"],
    lofi: ["#9796F0", "#FBC8D5"],
    ambient: ["#00C9FF", "#92FE9D"],
    default: ["#7c5cff", "#00d4ff"],
};

// 12 个情绪标签 -> 海报主配色（情绪光影模板使用）
let EMOTION_COLORS = {
    happy: ["#f6d365", "#fda085"],
    sad: ["#4b6cb7", "#182848"],
    relaxing: ["#56ab2f", "#a8e063"],
    energetic: ["#f83600", "#f9d423"],
    calm: ["#74ebd5", "#9face6"],
    romantic: ["#f093fb", "#f5576c"],
    nostalgic: ["#d4a373", "#7f5539"],
    focused: ["#414345", "#232526"],
    tired: ["#616161", "#9bc5c3"],
    angry: ["#c31432", "#240b36"],
    lonely: ["#5c6bc0", "#8e24aa"],
    cheerful: ["#f7971e", "#ffd200"],
};

// ---------- 模板与尺寸 ----------
// 顺序与 index.html 缩略图条一致；thumb 为缩略图代表色（供点选预览）
const POSTER_TEMPLATES = [
    { key: "cover", name: "封面沉浸", group: "沉浸氛围", thumb: "linear-gradient(135deg,#5b8cff,#a78bfa)" },
    { key: "emotion", name: "极光", group: "沉浸氛围", thumb: "linear-gradient(135deg,#74ebd5,#9face6)" },
    { key: "minimal", name: "极简杂志", group: "杂志排版", thumb: "linear-gradient(135deg,#f7f4ec,#ece5d7)" },
    { key: "vinyl", name: "黑胶唱片", group: "复古质感", thumb: "linear-gradient(135deg,#1c1c22,#0a0a0e)" },
    { key: "polaroid", name: "胶片拍立得", group: "复古质感", thumb: "linear-gradient(135deg,#f5f1e8,#e8dcc8)" },
    { key: "lyric", name: "歌词海报", group: "纯文字", thumb: "linear-gradient(135deg,#232526,#414345)" },
];
const POSTER_SIZES = {
    portrait: { name: "竖版 9:16", w: 540, h: 960 },
    square: { name: "方形 1:1", w: 640, h: 640 },
};

// 每套模板的背景变体（「换背景」按钮轮换）
const BG_VARIANTS = {
    cover: [
        { key: "blur", name: "封面模糊" },
        { key: "blur_aurora", name: "模糊 + 极光" },
        { key: "blur_star", name: "模糊 + 星空" },
    ],
    minimal: [
        { key: "paper", name: "纸感" },
        { key: "paper_grid", name: "纸感 + 网格" },
        { key: "paper_mesh", name: "纸感 + 柔光" },
    ],
    vinyl: [
        { key: "black", name: "纯黑" },
        { key: "black_nebula", name: "黑 + 星云" },
        { key: "black_wave", name: "黑 + 声波" },
    ],
    emotion: [
        { key: "bokeh", name: "渐变光斑" },
        { key: "aurora", name: "极光" },
        { key: "nebula", name: "星云" },
        { key: "leak", name: "漏光" },
    ],
    polaroid: [
        { key: "paper", name: "奶白相纸" },
        { key: "paper_scratch", name: "相纸 + 划痕" },
        { key: "paper_leak", name: "相纸 + 漏光" },
    ],
    lyric: [
        { key: "dark", name: "深色" },
        { key: "dark_aurora", name: "深色 + 极光" },
        { key: "dark_star", name: "深色 + 星点" },
    ],
};

const state = { song: null, template: 0, bg: 0, size: "portrait" };
const coverCache = new Map();
const noiseCache = new Map();

// ---------- 工具 ----------
function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// 在线封面走站内代理变同源，避免 canvas 被污染导致 toBlob 失败；
// 本地 /media/ 路径本身同源，直接用。
function proxifyCover(src) {
    if (!src) return "";
    const s = String(src);
    if (!/^https?:\/\//i.test(s)) return s;
    return "/api/posters/cover/?url=" + encodeURIComponent(s);
}

function loadCachedCover(src) {
    if (!src) return Promise.resolve(null);
    if (coverCache.has(src)) return Promise.resolve(coverCache.get(src));
    // 缓存键用原 src（同一首歌复用），实际加载走代理
    return loadImage(proxifyCover(src)).then((img) => { coverCache.set(src, img); return img; });
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function wrapLines(ctx, text, font, maxW) {
    ctx.font = font;
    const chars = Array.from(String(text || ""));
    if (!chars.length) return [];
    if (ctx.measureText(chars.join("")).width <= maxW) return [text];
    const rows = [];
    let line = "";
    for (const c of chars) {
        if (ctx.measureText(line + c).width > maxW) {
            rows.push(line);
            line = c;
        } else {
            line += c;
        }
    }
    if (line) rows.push(line);
    return rows;
}

function makeNoiseCanvas(W, H, density) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const cx = c.getContext("2d");
    const img = cx.createImageData(W, H);
    const d = img.data;
    const count = Math.floor(W * H * density);
    for (let i = 0; i < count; i++) {
        const p = (Math.random() * W * H) | 0;
        const o = p * 4;
        d[o] = Math.random() * 255;
        d[o + 1] = d[o];
        d[o + 2] = d[o];
        d[o + 3] = 18 + Math.random() * 22;
    }
    cx.putImageData(img, 0, 0);
    return c;
}

function getNoise(W, H, density) {
    const key = `${W}x${H}x${density}`;
    if (!noiseCache.has(key)) noiseCache.set(key, makeNoiseCanvas(W, H, density));
    return noiseCache.get(key);
}

function fillGradientText(ctx, text, x, y, c1, c2) {
    const g = ctx.createLinearGradient(0, y - 34, 0, y + 6);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
}

function songTags(song) {
    const t = song.tags;
    if (Array.isArray(t)) return t.filter(Boolean);
    if (typeof t === "string" && t) return t.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
}

function paletteFor(song) {
    return posterPalettes[song.genre] || posterPalettes.default;
}

function emotionColorsFor(song) {
    const tags = songTags(song);
    for (const t of tags) {
        if (EMOTION_COLORS[t]) return EMOTION_COLORS[t];
    }
    return EMOTION_COLORS.happy;
}

function getLyricContext(n) {
    try {
        const lines = (window.lyricLines && window.lyricLines()) || [];
        if (!lines.length) return [];
        const cur = (window.currentLyricIndex && window.currentLyricIndex()) ?? -1;
        const start = Math.max(0, Math.min(cur >= 0 ? cur - 2 : 0, lines.length - n));
        return lines.slice(start, start + n).map((l) => l.text).filter(Boolean);
    } catch (e) {
        return [];
    }
}

// ---------- 背景层 ----------
function hexA(hex, a) {
    hex = String(hex || "").replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length !== 6) return `rgba(255,255,255,${a})`;
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// 固定种子随机（保证预览与导出的装饰位置一致）
function seededRnd(W, H) {
    let seed = (Math.round(W) * 73856093) ^ (Math.round(H) * 19349663);
    if (!seed) seed = 123456789;
    return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

// 极光带：压扁的径向渐变椭圆错落叠加，形成梦幻流动光带
function decorAurora(ctx, W, H, colors, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const a = alpha || 0.5;
    const bands = [
        { x: W * 0.5, y: H * 0.24, rx: W * 0.78, ry: W * 0.055, c: colors[0] },
        { x: W * 0.55, y: H * 0.42, rx: W * 0.7, ry: W * 0.05, c: colors[1] },
        { x: W * 0.45, y: H * 0.58, rx: W * 0.82, ry: W * 0.045, c: "#ffffff" },
        { x: W * 0.52, y: H * 0.7, rx: W * 0.62, ry: W * 0.04, c: colors[0] },
    ];
    bands.forEach((b) => {
        ctx.translate(b.x, b.y);
        ctx.scale(1, b.ry / b.rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
        g.addColorStop(0, hexA(b.c, a));
        g.addColorStop(1, hexA(b.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, b.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
    ctx.restore();
}

// 星空：固定种子的星点（可叠加在任意底色上）
function drawStars(ctx, W, H, count) {
    const rnd = seededRnd(W, H);
    const n = count || Math.max(40, Math.round((W * H) / 7000));
    ctx.save();
    for (let i = 0; i < n; i++) {
        const x = rnd() * W, y = rnd() * H;
        const r = 0.5 + rnd() * 1.5;
        const a = 0.15 + rnd() * 0.55;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// 星云：大范围彩云雾团 + 星点
function decorNebula(ctx, W, H, colors) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const spots = [
        { x: W * 0.16, y: H * 0.26, r: W * 0.55, c: colors[0], a: 0.5 },
        { x: W * 0.84, y: H * 0.72, r: W * 0.6, c: colors[1], a: 0.45 },
        { x: W * 0.55, y: H * 0.12, r: W * 0.35, c: "#ffffff", a: 0.12 },
    ];
    spots.forEach((s) => {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        g.addColorStop(0, hexA(s.c, s.a));
        g.addColorStop(1, hexA(s.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
    drawStars(ctx, W, H);
}

// 漏光：斜向光束 + 角落光晕（胶片感）
function decorLightLeak(ctx, W, H, colors) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, hexA(colors[0], 0.5));
    g.addColorStop(0.45, hexA(colors[0], 0.04));
    g.addColorStop(0.7, hexA(colors[1], 0.1));
    g.addColorStop(1, hexA(colors[1], 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.82, 0);
    ctx.lineTo(W * 0.18, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    const spots = [
        { x: 0, y: H * 0.15, r: W * 0.5, c: colors[0], a: 0.35 },
        { x: W, y: H * 0.9, r: W * 0.45, c: colors[1], a: 0.3 },
    ];
    spots.forEach((s) => {
        const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        rg.addColorStop(0, hexA(s.c, s.a));
        rg.addColorStop(1, hexA(s.c, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// 网格线（杂志排版感）
function decorGrid(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = "rgba(43,38,32,0.09)";
    ctx.lineWidth = 1;
    const step = Math.round(W * 0.09);
    for (let x = step; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = step; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
}

// 柔光彩斑（纸色上的柔和渐变晕染）
function decorMesh(ctx, W, H, colors) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const spots = [
        { x: W * 0.8, y: H * 0.18, r: W * 0.5, c: colors[0], a: 0.45 },
        { x: W * 0.15, y: H * 0.8, r: W * 0.45, c: colors[1], a: 0.4 },
        { x: W * 0.5, y: H * 0.45, r: W * 0.38, c: "#ffffff", a: 0.3 },
    ];
    spots.forEach((s) => {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        g.addColorStop(0, hexA(s.c, s.a));
        g.addColorStop(1, hexA(s.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// 声波环：环绕黑胶唱片的扩散波动（位置与 drawVinylDisc 保持一致）
function decorVinylWave(ctx, W, H, cx, cy, R) {
    ctx.save();
    ctx.lineWidth = 1.5;
    for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = `rgba(255,255,255,${(0.30 - ring * 0.07).toFixed(2)})`;
        const r0 = R * 1.35 + ring * R * 0.22;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.06) {
            const rr = r0 + Math.sin(a * 10 + ring * 2.1) * R * 0.05;
            const x = cx + Math.cos(a) * rr;
            const y = cy + Math.sin(a) * rr;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

async function drawCoverBg(ctx, W, H, song, variant) {
    const img = await loadCachedCover(song.cover);
    if (img) {
        ctx.save();
        ctx.filter = "blur(24px) brightness(0.62) saturate(1.15)";
        const scale = Math.max(W / img.width, H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
    } else {
        const pal = paletteFor(song);
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, pal[0]);
        g.addColorStop(1, pal[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
    // 背景变体装饰
    if (variant === "blur_aurora") decorAurora(ctx, W, H, paletteFor(song));
    else if (variant === "blur_star") decorNebula(ctx, W, H, paletteFor(song));
    // 上方淡淡品牌渐晕，方便顶部信息阅读
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.28);
    top.addColorStop(0, "rgba(0,0,0,0.35)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.28);
}

function drawMinimalBg(ctx, W, H, song, variant) {
    const pal = paletteFor(song);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f7f4ec");
    g.addColorStop(1, "#ece5d7");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 杂志感装饰：半透明大色块 + 细线
    ctx.fillStyle = pal[0] + "18";
    ctx.beginPath();
    ctx.arc(W * 0.88, H * 0.12, W * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal[1] + "1a";
    ctx.beginPath();
    ctx.arc(W * 0.06, H * 0.9, W * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(43,38,32,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, H * 0.21);
    ctx.lineTo(W * 0.92, H * 0.21);
    ctx.stroke();
    // 背景变体装饰
    if (variant === "paper_grid") decorGrid(ctx, W, H);
    else if (variant === "paper_mesh") decorMesh(ctx, W, H, pal);
    // 右上角歌名首字装饰
    const first = Array.from(song.title || "乐")[0];
    ctx.font = `700 ${Math.round(W * 0.62)}px 'PingFang SC','Microsoft YaHei',serif`;
    ctx.fillStyle = "rgba(43,38,32,0.05)";
    ctx.textAlign = "right";
    ctx.fillText(first, W * 0.94, H * 0.34);
    ctx.textAlign = "center";
}

function drawVinylBg(ctx, W, H, variant) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1c1c22");
    g.addColorStop(1, "#0a0a0e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 背景变体装饰
    if (variant === "black_nebula") decorNebula(ctx, W, H, ["#5b3a9e", "#1b2a6b"]);
    else if (variant === "black_wave") decorVinylWave(ctx, W, H, W / 2, H * 0.40, W * 0.33);
    // 顶部细线 + 标签感文字
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${Math.round(W * 0.028)}px 'PingFang SC',sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Y U N L V   A I", W / 2, H * 0.05);
}

function drawEmotionBg(ctx, W, H, song, variant) {
    const [c0, c1] = emotionColorsFor(song);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 背景变体装饰
    if (variant === "bokeh") decorBokeh(ctx, W, H);
    else if (variant === "aurora") decorAurora(ctx, W, H, [c0, c1]);
    else if (variant === "nebula") decorNebula(ctx, W, H, [c0, c1]);
    else if (variant === "leak") decorLightLeak(ctx, W, H, [c0, c1]);
}

// 胶片划痕：随机细斜线，模拟老胶片损伤（拍立得变体用）
function decorScratch(ctx, W, H) {
    const rnd = seededRnd(W + 7, H - 3);
    ctx.save();
    ctx.strokeStyle = "rgba(60,50,40,0.18)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 14; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const len = W * (0.06 + rnd() * 0.22);
        const ang = (-Math.PI / 4) + (rnd() - 0.5) * 0.6;
        ctx.globalAlpha = 0.10 + rnd() * 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        ctx.stroke();
    }
    ctx.restore();
}

// 拍立得背景：奶白相纸底 + 变体装饰
function drawPolaroidBg(ctx, W, H, song, variant) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f5f1e8");
    g.addColorStop(1, "#e8dcc8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (variant === "paper_scratch") decorScratch(ctx, W, H);
    else if (variant === "paper_leak") decorLightLeak(ctx, W, H, emotionColorsFor(song));
}

// 纯文字歌词海报背景：深色 + 变体装饰（情绪配色极光/星点，压低透明度不抢文字）
function drawLyricBg(ctx, W, H, song, variant) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1a1a22");
    g.addColorStop(1, "#0d0d12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const ec = emotionColorsFor(song);
    if (variant === "dark_aurora") {
        ctx.save();
        ctx.globalAlpha = 0.5;
        decorAurora(ctx, W, H, ec);
        ctx.restore();
    } else if (variant === "dark_star") {
        ctx.save();
        ctx.globalAlpha = 0.6;
        decorNebula(ctx, W, H, [ec[0], ec[1]]);
        ctx.restore();
    }
}

// 白色光斑（大光圈 bokeh，极光模板默认变体）
function decorBokeh(ctx, W, H) {
    const spots = [
        { x: W * 0.84, y: H * 0.10, r: W * 0.5, a: 0.20 },
        { x: W * 0.08, y: H * 0.75, r: W * 0.46, a: 0.16 },
        { x: W * 0.55, y: H * 0.50, r: W * 0.34, a: 0.10 },
    ];
    spots.forEach((s) => {
        const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        rg.addColorStop(0, `rgba(255,255,255,${s.a})`);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.40)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

// ---------- 歌词 ----------
function drawLyricRows(ctx, rows, cx, y, W, style) {
    // rows: [{text, isMain, lines:[...]}]
    let cursor = y;
    for (const r of rows) {
        const fontMain = `700 ${style.mainSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
        const fontSub = `500 ${style.subSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
        r.lines.forEach((ln, i) => {
            if (r.isMain) {
                ctx.font = fontMain;
                ctx.textAlign = "center";
                ctx.shadowColor = "rgba(0,0,0,0.35)";
                ctx.shadowBlur = 14;
                fillGradientText(ctx, ln, cx, cursor, style.mainTop, style.mainBottom);
                ctx.shadowBlur = 0;
            } else {
                ctx.font = fontSub;
                ctx.textAlign = "center";
                ctx.fillStyle = style.subColor;
                ctx.fillText(ln, cx, cursor);
            }
            cursor += (i === 0 && r.isMain) ? style.mainLineH : style.subLineH;
        });
    }
}

function buildLyricRows(ctx, texts, maxW, mainSize, subSize) {
    const fontMain = `700 ${mainSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
    const fontSub = `500 ${subSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
    const mainIdx = Math.floor(texts.length / 2);
    return texts.map((t, i) => {
        const isMain = i === mainIdx;
        const font = isMain ? fontMain : fontSub;
        return { text: t, isMain, lines: wrapLines(ctx, t, font, maxW) };
    });
}

function drawGlassBlock(ctx, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = "rgba(18,18,32,0.30)";
    ctx.fill();
    // 顶部高光边
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1.5);
    ctx.lineTo(x + w - r, y + 1.5);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function drawCenterLyrics(ctx, W, H, texts, style) {
    const cx = W / 2;
    const maxW = W - Math.round(W * 0.18);
    const mainSize = Math.round(W * (style === "cover" ? 0.063 : 0.068));
    const subSize = Math.round(W * 0.042);
    const mainLineH = Math.round(W * 0.086);
    const subLineH = Math.round(W * 0.063);
    const rows = buildLyricRows(ctx, texts, maxW, mainSize, subSize);
    if (!rows.length) {
        ctx.font = `500 ${subSize}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.fillText("♪ 纯音乐 · 享受此刻", cx, H * 0.42);
        return;
    }
    const totalH = rows.reduce((acc, r) => acc + (r.isMain ? r.lines.length * mainLineH : r.lines.length * subLineH), 0);
    const centerY = H * (style === "cover" ? 0.36 : 0.44);
    let startY = centerY - totalH / 2 + (mainLineH * 0.72);
    const pad = Math.round(W * 0.045);
    drawGlassBlock(ctx, cx - maxW / 2 - pad, startY - mainLineH * 0.8, maxW + pad * 2, totalH + mainLineH * 0.6 + pad, Math.round(W * 0.05));
    drawLyricRows(ctx, rows, cx, startY, W, {
        mainSize, subSize, mainLineH, subLineH,
        mainTop: "rgba(255,255,255,1)",
        mainBottom: "rgba(255,255,255,0.82)",
        subColor: "rgba(255,255,255,0.66)",
    });
}

function drawMinimalLyrics(ctx, W, H, texts) {
    const cx = W / 2;
    const maxW = W - Math.round(W * 0.2);
    const mainSize = Math.round(W * 0.075);
    const subSize = Math.round(W * 0.044);
    const mainLineH = Math.round(W * 0.1);
    const subLineH = Math.round(W * 0.066);
    const rows = buildLyricRows(ctx, texts, maxW, mainSize, subSize);
    if (!rows.length) {
        ctx.font = `500 ${subSize}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(43,38,32,0.5)";
        ctx.textAlign = "center";
        ctx.fillText("♪ 纯音乐 · 享受此刻", cx, H * 0.5);
        return;
    }
    const totalH = rows.reduce((acc, r) => acc + (r.isMain ? r.lines.length * mainLineH : r.lines.length * subLineH), 0);
    const startY = H * 0.48 - totalH / 2 + mainLineH * 0.72;
    drawLyricRows(ctx, rows, cx, startY, W, {
        mainSize, subSize, mainLineH, subLineH,
        mainTop: "#2b2620",
        mainBottom: "rgba(43,38,32,0.85)",
        subColor: "rgba(43,38,32,0.42)",
    });
}

function drawVinylLyrics(ctx, W, H, texts) {
    const cx = W / 2;
    const maxW = W - Math.round(W * 0.16);
    const mainSize = Math.round(W * 0.052);
    const subSize = Math.round(W * 0.036);
    const mainLineH = Math.round(W * 0.074);
    const subLineH = Math.round(W * 0.052);
    const rows = buildLyricRows(ctx, texts, maxW, mainSize, subSize);
    const baseY = H * 0.72;
    if (!rows.length) {
        ctx.font = `500 ${subSize}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "center";
        ctx.fillText("♪ 纯音乐 · 享受此刻", cx, baseY);
        return;
    }
    drawLyricRows(ctx, rows, cx, baseY, W, {
        mainSize, subSize, mainLineH, subLineH,
        mainTop: "#ffffff",
        mainBottom: "rgba(255,255,255,0.85)",
        subColor: "rgba(255,255,255,0.5)",
    });
}

// ---------- 拍立得主体（相纸白框 + 顶部照片 + 底部宽边写字） ----------
function drawPolaroidBody(ctx, W, H, song, coverImg) {
    const photoSize = Math.round(W * 0.74);
    const pad = Math.round(W * 0.045);       // 照片到相纸的边距
    const bottomPad = Math.round(W * 0.20); // 底部宽白边（写字区）
    const frameX = Math.round((W - photoSize) / 2 - pad);
    const frameY = Math.round(H * 0.085);
    const frameW = photoSize + pad * 2;
    const frameH = photoSize + pad + bottomPad;

    // 相纸白底 + 阴影
    ctx.save();
    ctx.shadowColor = "rgba(60,45,30,0.28)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, frameX, frameY, frameW, frameH, Math.round(W * 0.02));
    ctx.fillStyle = "#fffdf7";
    ctx.fill();
    ctx.restore();

    // 照片区裁切
    const px = frameX + pad;
    const py = frameY + pad;
    ctx.save();
    roundRect(ctx, px, py, photoSize, photoSize, Math.round(W * 0.012));
    ctx.clip();
    if (coverImg) {
        const s = Math.max(photoSize / coverImg.width, photoSize / coverImg.height);
        const dw = coverImg.width * s, dh = coverImg.height * s;
        ctx.drawImage(coverImg, px + (photoSize - dw) / 2, py + (photoSize - dh) / 2, dw, dh);
    } else {
        const [c0, c1] = paletteFor(song);
        const g = ctx.createLinearGradient(px, py, px + photoSize, py + photoSize);
        g.addColorStop(0, c0); g.addColorStop(1, c1);
        ctx.fillStyle = g; ctx.fillRect(px, py, photoSize, photoSize);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `700 ${Math.round(photoSize * 0.4)}px 'PingFang SC',sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(Array.from(song.title || "乐")[0], px + photoSize / 2, py + photoSize / 2 + 2);
        ctx.textBaseline = "alphabetic";
    }
    // 照片做旧颗粒
    try { ctx.drawImage(getNoise(W, H, 0.05), px, py, photoSize, photoSize); } catch (e) { /* ignore */ }
    ctx.restore();
    // 照片细边
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    roundRect(ctx, px, py, photoSize, photoSize, Math.round(W * 0.012));
    ctx.stroke();

    // 底部宽边文字
    const cx = W / 2;
    const ty = py + photoSize + bottomPad * 0.42;
    ctx.textAlign = "center";
    ctx.fillStyle = "#2b2620";
    ctx.font = `700 ${Math.round(W * 0.058)}px 'PingFang SC','Microsoft YaHei',sans-serif`;
    ctx.fillText(truncateText(ctx, song.title || "未知歌曲", W * 0.7), cx, ty);
    ctx.font = `400 ${Math.round(W * 0.034)}px 'PingFang SC',sans-serif`;
    ctx.fillStyle = "rgba(43,38,32,0.6)";
    ctx.fillText(song.artist || "", cx, ty + Math.round(W * 0.05));
    // 一句歌词（情绪配色点缀）
    const lctx = getLyricContext(1);
    if (lctx.length) {
        ctx.font = `400 ${Math.round(W * 0.03)}px 'PingFang SC',sans-serif`;
        const [c0] = emotionColorsFor(song);
        ctx.fillStyle = hexA(c0, 0.85);
        ctx.fillText(truncateText(ctx, lctx[0], W * 0.7), cx, ty + Math.round(W * 0.092));
    }
    // 右下日期戳（拍立得真实感）
    ctx.textAlign = "right";
    ctx.font = `400 ${Math.round(W * 0.026)}px 'PingFang SC',sans-serif`;
    ctx.fillStyle = "rgba(43,38,32,0.4)";
    const d = new Date();
    const stamp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    ctx.fillText(stamp, frameX + frameW - pad, frameY + frameH - Math.round(W * 0.018));
    ctx.textAlign = "center";
}

// ---------- 纯文字歌词海报（全屏歌词为主，无封面） ----------
function drawLyricLyrics(ctx, W, H, texts) {
    const cx = W / 2;
    const maxW = W - Math.round(W * 0.16);
    const mainSize = Math.round(W * 0.085);
    const subSize = Math.round(W * 0.052);
    const lineH = Math.round(W * 0.11);

    const rows = texts.slice(0, 5);
    if (!rows.length) {
        ctx.font = `500 ${subSize}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.fillText("♪ 纯音乐 · 享受此刻", cx, H * 0.5);
        return;
    }
    // 中间为主句，上下副句透明度逐行递减
    const mainIdx = Math.floor(rows.length / 2);
    const wrapped = rows.map((t, i) => {
        const isMain = i === mainIdx;
        const font = `700 ${isMain ? mainSize : subSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
        return { text: t, isMain, lines: wrapLines(ctx, t, font, maxW), idx: i };
    });
    let totalH = 0;
    wrapped.forEach((r) => { totalH += r.lines.length * lineH; });
    let y = H * 0.5 - totalH / 2 + lineH * 0.72;
    ctx.textAlign = "center";
    wrapped.forEach((r) => {
        const dist = Math.abs(r.idx - mainIdx);
        const alpha = r.isMain ? 1 : Math.max(0.32, 0.85 - dist * 0.18);
        r.lines.forEach((ln) => {
            ctx.font = `700 ${r.isMain ? mainSize : subSize}px 'PingFang SC','Microsoft YaHei',sans-serif`;
            if (r.isMain) {
                ctx.shadowColor = "rgba(0,0,0,0.4)";
                ctx.shadowBlur = 16;
                ctx.fillStyle = "rgba(255,255,255,1)";
            } else {
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            }
            ctx.fillText(ln, cx, y);
            ctx.shadowBlur = 0;
            y += lineH;
        });
    });
}

// ---------- 黑胶唱片 ----------
function drawVinylDisc(ctx, cx, cy, R, img) {
    // 盘身
    const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, R * 0.05, cx, cy, R);
    g.addColorStop(0, "#2c2c33");
    g.addColorStop(1, "#0a0a0e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // 同心圆纹路
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let r = R * 0.26; r < R * 0.92; r += R * 0.095) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    // 高光
    const hl = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, 0, cx, cy, R);
    hl.addColorStop(0, "rgba(255,255,255,0.10)");
    hl.addColorStop(0.4, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // 封面贴纸
    const r2 = R * 0.44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
        ctx.drawImage(img, cx - r2, cy - r2, r2 * 2, r2 * 2);
    } else {
        ctx.fillStyle = "#3a3a44";
        ctx.fillRect(cx - r2, cy - r2, r2 * 2, r2 * 2);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r2, 0, Math.PI * 2);
    ctx.stroke();
    // 中心孔
    ctx.fillStyle = "#0c0c10";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(8, R * 0.055), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(cx - R * 0.02, cy - R * 0.02, Math.max(3, R * 0.02), 0, Math.PI * 2);
    ctx.fill();
}

// ---------- 信息区 / 标签 / 水印 ----------
function drawCoverInfo(ctx, W, H, song, img) {
    const cardSize = Math.round(W * 0.21);
    const x = Math.round(W * 0.07);
    const y = Math.round(H * 0.76);
    // 封面小卡
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, cardSize, cardSize, Math.round(cardSize * 0.16));
    ctx.fillStyle = "rgba(20,20,35,0.5)";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, cardSize, cardSize, Math.round(cardSize * 0.16));
    ctx.clip();
    if (img) {
        ctx.drawImage(img, x, y, cardSize, cardSize);
    } else {
        const [c0, c1] = paletteFor(song);
        const g = ctx.createLinearGradient(x, y, x + cardSize, y + cardSize);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cardSize, cardSize);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = `700 ${Math.round(cardSize * 0.4)}px 'PingFang SC',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Array.from(song.title || "乐")[0], x + cardSize / 2, y + cardSize / 2 + 2);
        ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, cardSize, cardSize, Math.round(cardSize * 0.16));
    ctx.stroke();

    // 右侧歌曲信息
    const tx = x + cardSize + Math.round(W * 0.045);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(W * 0.056)}px 'PingFang SC','Microsoft YaHei',sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 8;
    ctx.fillText(truncateText(ctx, song.title || "未知歌曲", W * 0.6), tx, y + Math.round(H * 0.045));
    ctx.shadowBlur = 0;
    ctx.font = `400 ${Math.round(W * 0.034)}px 'PingFang SC',sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(truncateText(ctx, song.artist || "", W * 0.6), tx, y + Math.round(H * 0.078));
    if (song.album) {
        ctx.font = `400 ${Math.round(W * 0.03)}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText("专辑 · " + truncateText(ctx, song.album, W * 0.6), tx, y + Math.round(H * 0.104));
    }
}

function drawBottomInfo(ctx, W, H, song, dark) {
    const tx = W * 0.08;
    const y = H - Math.round(H * 0.075);
    ctx.textAlign = "left";
    ctx.fillStyle = dark ? "#2b2620" : "#ffffff";
    ctx.font = `700 ${Math.round(W * 0.052)}px 'PingFang SC','Microsoft YaHei',sans-serif`;
    ctx.fillText(truncateText(ctx, song.title || "未知歌曲", W * 0.6), tx, y - Math.round(H * 0.018));
    ctx.font = `400 ${Math.round(W * 0.032)}px 'PingFang SC',sans-serif`;
    ctx.fillStyle = dark ? "rgba(43,38,32,0.55)" : "rgba(255,255,255,0.7)";
    ctx.fillText(song.artist || "", tx, y + Math.round(H * 0.012));
}

function truncateText(ctx, text, maxW) {
    text = String(text || "");
    ctx.font = ctx.font;
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}

function drawWatermark(ctx, W, H, tpl) {
    ctx.textAlign = "center";
    ctx.font = `400 ${Math.round(W * 0.03)}px 'PingFang SC',sans-serif`;
    ctx.fillStyle = tpl === "minimal" ? "rgba(43,38,32,0.4)" : "rgba(255,255,255,0.5)";
    ctx.fillText("云律 AI · 懂情绪的音乐播放器", W / 2, H - Math.round(H * 0.035));
}

// ---------- 主渲染 ----------
async function renderPoster(ctx, W, H, song, tpl, variant) {
    ctx.clearRect(0, 0, W, H);
    const coverImg = await loadCachedCover(song.cover);

    if (tpl === "cover") {
        await drawCoverBg(ctx, W, H, song, variant);
        drawVignette(ctx, W, H);
        drawCenterLyrics(ctx, W, H, getLyricContext(5), "cover");
        drawCoverInfo(ctx, W, H, song, coverImg);
        drawWatermark(ctx, W, H, tpl);
    } else if (tpl === "minimal") {
        drawMinimalBg(ctx, W, H, song, variant);
        drawMinimalLyrics(ctx, W, H, getLyricContext(5));
        drawBottomInfo(ctx, W, H, song, true);
        drawWatermark(ctx, W, H, tpl);
    } else if (tpl === "vinyl") {
        drawVinylBg(ctx, W, H, variant);
        // 顶部标题
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(W * 0.052)}px 'PingFang SC','Microsoft YaHei',sans-serif`;
        ctx.fillText(truncateText(ctx, song.title || "未知歌曲", W * 0.8), W / 2, H * 0.11);
        ctx.font = `400 ${Math.round(W * 0.032)}px 'PingFang SC',sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(song.artist || "", W / 2, H * 0.145);
        // 唱片
        drawVinylDisc(ctx, W / 2, H * 0.40, W * 0.33, coverImg);
        drawVinylLyrics(ctx, W, H, getLyricContext(3));
        drawWatermark(ctx, W, H, tpl);
    } else if (tpl === "polaroid") {
        drawPolaroidBg(ctx, W, H, song, variant);
        drawPolaroidBody(ctx, W, H, song, coverImg);
        drawWatermark(ctx, W, H, tpl);
    } else if (tpl === "lyric") {
        drawLyricBg(ctx, W, H, song, variant);
        drawVignette(ctx, W, H);
        drawLyricLyrics(ctx, W, H, getLyricContext(5));
        drawBottomInfo(ctx, W, H, song, false);
        drawWatermark(ctx, W, H, tpl);
    } else {
        drawEmotionBg(ctx, W, H, song, variant);
        drawVignette(ctx, W, H);
        drawCenterLyrics(ctx, W, H, getLyricContext(5), "emotion");
        drawBottomInfo(ctx, W, H, song, false);
        drawWatermark(ctx, W, H, tpl);
    }

    // 噪点质感（canvas 被 CORS 污染时跳过）
    try {
        const dens = (tpl === "emotion" || tpl === "lyric") ? 0.045 : 0.03;
        ctx.drawImage(getNoise(W, H, dens), 0, 0);
    } catch (e) { /* ignore */ }
}

// ---------- 对外 API ----------
window.closePosterModal = () => {
    document.getElementById("poster-modal").style.display = "none";
};

function updateUI() {
    const tpl = POSTER_TEMPLATES[state.template];
    const variant = BG_VARIANTS[tpl.key][state.bg];
    const label = document.getElementById("poster-template-name");
    if (label) label.textContent = `${tpl.group} · ${tpl.name} ｜ 背景 · ${variant ? variant.name : ""}`;
    document.querySelectorAll(".poster-size-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.size === state.size);
    });
    // 缩略图条高亮当前模板
    document.querySelectorAll(".poster-thumb").forEach((b, i) => {
        b.classList.toggle("active", i === state.template);
    });
}

// 渲染模板缩略图条（用代表色渐变占位，避免 6 个 canvas 实时渲染的开销）
function renderThumbnails() {
    const box = document.getElementById("poster-thumbs");
    if (!box || box.childElementCount) return; // 已渲染则跳过
    POSTER_TEMPLATES.forEach((tpl, i) => {
        const b = document.createElement("button");
        b.className = "poster-thumb";
        b.title = tpl.name;
        b.dataset.idx = i;
        b.innerHTML = `<span class="poster-thumb-bg" style="background:${tpl.thumb}"></span>
                       <span class="poster-thumb-name">${tpl.name}</span>`;
        b.addEventListener("click", () => {
            if (state.template === i) return;
            state.template = i;
            state.bg = 0;
            drawPoster();
        });
        box.appendChild(b);
    });
}

async function drawPoster() {
    const s = state;
    if (!s.song) return;
    const size = POSTER_SIZES[s.size];
    const canvas = document.getElementById("poster-canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    const tpl = POSTER_TEMPLATES[s.template];
    await renderPoster(ctx, size.w, size.h, s.song, tpl.key, BG_VARIANTS[tpl.key][s.bg].key);
    updateUI();
}

async function makePoster() {
    const song = window.player && window.player.currentSong;
    if (!song) { alert("请先播放一首歌，再生成歌词海报"); return; }
    state.song = song;
    state.template = 0;
    state.bg = 0;
    renderThumbnails();
    document.getElementById("poster-modal").style.display = "flex";
    await drawPoster();
}

function downloadPoster() {
    const s = state;
    if (!s.song) return;
    const size = POSTER_SIZES[s.size];
    const canvas = document.createElement("canvas");
    canvas.width = size.w * 2;
    canvas.height = size.h * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    const tpl = POSTER_TEMPLATES[s.template];
    renderPoster(ctx, size.w, size.h, s.song, tpl.key, BG_VARIANTS[tpl.key][s.bg].key).then(() => {
        canvas.toBlob((blob) => {
            if (!blob) { alert("导出失败"); return; }
            const a = document.createElement("a");
            a.download = `云律AI_歌词海报_${s.song.title || "song"}.png`;
            a.href = URL.createObjectURL(blob);
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }, "image/png");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-make-poster").addEventListener("click", makePoster);
    document.getElementById("poster-bg-refresh").addEventListener("click", () => {
        const tpl = POSTER_TEMPLATES[state.template];
        const variants = BG_VARIANTS[tpl.key];
        state.bg = (state.bg + 1) % variants.length;
        drawPoster();
    });
    document.getElementById("poster-download").addEventListener("click", downloadPoster);
    document.querySelectorAll(".poster-size-btn").forEach((b) => {
        b.addEventListener("click", () => {
            state.size = b.dataset.size;
            drawPoster();
        });
    });
    // 从后端同步配色与情绪配色（失败则用内置兜底）
    API.get("/api/posters/palette/").then((d) => {
        if (d.palettes) posterPalettes = d.palettes;
        if (d.emotions) EMOTION_COLORS = Object.assign(EMOTION_COLORS, d.emotions);
    }).catch(() => {});
});
})();
