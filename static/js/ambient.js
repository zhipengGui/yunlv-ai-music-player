/* ========== 情绪动态封面 · 全屏氛围背景 ==========
 * 播放时全屏极光/星云缓慢流动；换歌时背景色调随歌曲情绪平滑过渡；
 * 暂停时流速放缓、画面变暗。纯 Canvas 绘制，零外部依赖。
 * 画法精简自 poster.js 的 decorAurora / decorNebula，情绪色表与其保持一致。
 */
(function () {
    "use strict";

    const canvas = document.getElementById("ambient-bg");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    /* ---------- 情绪色表（与 poster.js EMOTION_COLORS 一致） ---------- */
    const EMOTION_COLORS = {
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
    // 品牌蓝紫（初始态 / 无情绪标签兜底）
    const DEFAULT_COLORS = ["#7c5cff", "#00d4ff"];

    /* ---------- 状态 ---------- */
    let current = [hexToRgb(DEFAULT_COLORS[0]), hexToRgb(DEFAULT_COLORS[1])]; // 当前插值中的 RGB
    let target = [hexToRgb(DEFAULT_COLORS[0]), hexToRgb(DEFAULT_COLORS[1])]; // 目标 RGB
    let firstSong = true;   // 首次切歌直接到位，避免从默认色缓缓渐变
    let speed = 1;          // 时间流速（暂停放缓）
    let baseAlpha = 0.55;   // 整体浓度（暂停变暗）
    let t = 0;              // 全局动画时间
    let lastTs = 0;
    let rafId = 0;
    let visible = true;
    let stars = [];
    // 动态背景一键开关（默认关闭，存 localStorage）：关闭时隐藏氛围层，回到纯深色主题背景
    const AMBIENT_KEY = "yunlu_ambient";
    let enabled = (() => {
        try { return localStorage.getItem(AMBIENT_KEY) === "on"; } catch (e) { return false; }
    })();

    /* ---------- 颜色工具 ---------- */
    function hexToRgb(hex) {
        hex = String(hex || "").replace("#", "");
        if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
        if (hex.length !== 6) return [255, 255, 255];
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgbStr(c, a) {
        return `rgba(${(c[0] | 0)},${(c[1] | 0)},${(c[2] | 0)},${a})`;
    }
    function mixRgb(x, y, k) {
        return [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
    }

    /* ---------- 取色逻辑（与 poster.js emotionColorsFor 同款） ---------- */
    function songTags(song) {
        const t = song && song.tags;
        if (Array.isArray(t)) return t.filter(Boolean);
        if (typeof t === "string" && t) return t.split(",").map((s) => s.trim()).filter(Boolean);
        return [];
    }
    function emotionColorsFor(song) {
        if (!song) return DEFAULT_COLORS;
        for (const tag of songTags(song)) {
            if (EMOTION_COLORS[tag]) return EMOTION_COLORS[tag];
        }
        return DEFAULT_COLORS;
    }

    /* ---------- 星点 ---------- */
    function rebuildStars() {
        const W = canvas.clientWidth || 1;
        const H = canvas.clientHeight || 1;
        const n = Math.min(120, Math.max(50, Math.round((W * H) / 16000)));
        stars = [];
        for (let i = 0; i < n; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random(),
                r: 0.6 + Math.random() * 1.4,
                a: 0.15 + Math.random() * 0.5,
                tw: 0.5 + Math.random() * 1.5,
                ph: Math.random() * Math.PI * 2,
            });
        }
    }

    /* ---------- 绘制层 ---------- */
    // 极光带：压扁的径向渐变椭圆错落叠加，x/y 随动画时间漂移形成流动
    function drawAurora(W, H, c0, c1, alpha) {
        const WHITE = [255, 255, 255];
        const bands = [
            { bx: 0.50, by: 0.24, rx: 0.78, ry: 0.055, c: c0, w: 1.0, sp: 0.12, ph: 0.0, ax: 0.16, ay: 0.030 },
            { bx: 0.55, by: 0.42, rx: 0.70, ry: 0.050, c: c1, w: 1.0, sp: 0.10, ph: 2.1, ax: 0.18, ay: 0.025 },
            { bx: 0.45, by: 0.58, rx: 0.82, ry: 0.045, c: WHITE, w: 0.5, sp: 0.14, ph: 4.2, ax: 0.20, ay: 0.030 },
            { bx: 0.52, by: 0.72, rx: 0.62, ry: 0.040, c: c0, w: 0.8, sp: 0.09, ph: 1.3, ax: 0.14, ay: 0.020 },
        ];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;
        for (const b of bands) {
            const x = W * (b.bx + Math.sin(t * b.sp + b.ph) * b.ax);
            const y = H * (b.by + Math.cos(t * b.sp * 0.8 + b.ph) * b.ay);
            const rx = W * b.rx;
            const ry = W * b.ry;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, ry / rx);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            g.addColorStop(0, rgbStr(b.c, b.w));
            g.addColorStop(1, rgbStr(b.c, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, rx, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // 星云：大范围彩云雾团缓慢漂移 + 半径脉动
    function drawNebula(W, H, c0, c1, alpha) {
        const WHITE = [255, 255, 255];
        const spots = [
            { bx: 0.16, by: 0.26, r: 0.55, c: c0, a: 0.50, sp: 0.06, ph: 0.0, ax: 0.050, ay: 0.040, ar: 0.04 },
            { bx: 0.84, by: 0.72, r: 0.60, c: c1, a: 0.45, sp: 0.05, ph: 2.5, ax: 0.040, ay: 0.050, ar: 0.03 },
            { bx: 0.55, by: 0.12, r: 0.35, c: WHITE, a: 0.10, sp: 0.07, ph: 4.0, ax: 0.060, ay: 0.030, ar: 0.05 },
        ];
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;
        for (const s of spots) {
            const x = W * (s.bx + Math.sin(t * s.sp + s.ph) * s.ax);
            const y = H * (s.by + Math.cos(t * s.sp * 0.9 + s.ph) * s.ay);
            const r = W * s.r * (1 + Math.sin(t * s.sp * 0.5 + s.ph) * s.ar);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, rgbStr(s.c, s.a));
            g.addColorStop(1, rgbStr(s.c, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // 星点：稀疏闪烁点缀，营造纵深
    function drawStars(W, H, alpha) {
        if (!stars.length) rebuildStars();
        ctx.save();
        ctx.globalAlpha = alpha;
        for (const s of stars) {
            const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.2 * s.tw + s.ph));
            ctx.fillStyle = `rgba(255,255,255,${(s.a * tw * 0.8).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /* ---------- 主循环 ---------- */
    function draw(ts) {
        rafId = requestAnimationFrame(draw);
        if (!enabled) return;   // 开关关闭：不绘制（画布已隐藏，节省资源）
        if (!visible) return;

        const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
        lastTs = ts;
        t += dt * speed;

        // 颜色向目标平滑过渡（约 1.5s 完成）
        current[0] = mixRgb(current[0], target[0], 0.035);
        current[1] = mixRgb(current[1], target[1], 0.035);

        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        if (!W || !H) return;
        ctx.clearRect(0, 0, W, H);

        const c0 = current[0];
        const c1 = current[1];

        // 1) 底色渐变
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, rgbStr(c0, 1));
        bg.addColorStop(1, rgbStr(c1, 1));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // 1.5) 深色罩：压低情绪色亮度，保证文字可读（情绪色转为氛围光晕，不抢前景）
        ctx.fillStyle = "rgba(13, 13, 19, .55)";
        ctx.fillRect(0, 0, W, H);

        // 2) 极光带（主要流动层）
        drawAurora(W, H, c0, c1, baseAlpha * 0.75);
        // 3) 星云（慢速大团光晕）
        drawNebula(W, H, c0, c1, baseAlpha * 0.6);
        // 4) 星点
        drawStars(W, H, baseAlpha);
    }

    /* ---------- 尺寸自适应（DPR 上限 1.5 保性能） ---------- */
    function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.round(window.innerWidth * dpr);
        const h = Math.round(window.innerHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildStars();
    }

    /* ---------- 事件 ---------- */
    function onSongChange(e) {
        const song = e.detail && e.detail.song;
        const colors = emotionColorsFor(song);
        target = [hexToRgb(colors[0]), hexToRgb(colors[1])];
        if (firstSong) {
            current = [target[0].slice(), target[1].slice()];
            firstSong = false;
        }
    }

    function bindPlayState() {
        const audio = window.player && window.player.audio;
        if (!audio) return;
        const update = () => {
            if (audio.paused) {
                speed = 0.35;
                baseAlpha = 0.38;
            } else {
                speed = 1;
                baseAlpha = 0.55;
            }
        };
        audio.addEventListener("play", update);
        audio.addEventListener("pause", update);
        audio.addEventListener("ended", update);
        update();
    }

    /* ---------- 启动 ---------- */
    function init() {
        bindPlayState();
        // 与海报共用同一份情绪色板，失败静默降级到内置色表
        if (window.API && API.get) {
            API.get("/api/posters/palette/").then((d) => {
                if (d && d.emotions) Object.assign(EMOTION_COLORS, d.emotions);
            }).catch(() => {});
        }
    }

    window.addEventListener("resize", fit);
    window.addEventListener("songchange", onSongChange);
    document.addEventListener("visibilitychange", () => {
        visible = !document.hidden;
        if (visible) lastTs = 0; // 重置时间基准，避免恢复后大跳变
    });

    /* ---------- 一键开关：动态氛围背景 ---------- */
    function syncVisibility() {
        canvas.style.display = enabled ? "" : "none";
    }
    function updateButton() {
        const btn = document.getElementById("ambient-btn");
        if (btn) btn.classList.toggle("ambient-on", enabled);
    }
    function toggleAmbient() {
        enabled = !enabled;
        try { localStorage.setItem(AMBIENT_KEY, enabled ? "on" : "off"); } catch (e) { /* 忽略 */ }
        syncVisibility();
        updateButton();
        if (enabled) lastTs = 0; // 恢复绘制时重置时间基准，避免大跳变
    }
    function bindToggle() {
        const btn = document.getElementById("ambient-btn");
        if (btn) btn.addEventListener("click", toggleAmbient);
        updateButton();
    }

    if (window.player) {
        init();
    } else {
        document.addEventListener("DOMContentLoaded", init);
    }
    fit();
    bindToggle();
    syncVisibility(); // 默认关闭：启动即隐藏氛围层
    rafId = requestAnimationFrame(draw);

    /* ---------- 设置面板控制接口 ---------- */
    window.AmbientBG = {
        isOn: () => enabled,
        set(on) {
            if (!!on !== enabled) toggleAmbient();
        },
    };
})();
