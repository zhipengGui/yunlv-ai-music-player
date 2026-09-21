/* ========== 云律 · 实时数据大屏 ==========
 * - 拉取 /api/report/dashboard/ 数据
 * - Canvas 自绘图表（趋势 / 24小时 / 情绪环形图），零外部依赖
 * - 每 4 秒轮询，实时播放流增量更新并高亮
 */
(function () {
    "use strict";

    const API_URL = "/api/report/dashboard/";
    const POLL_MS = 4000;
    const REFRESH_HINT_MS = 3000;

    const $ = (id) => document.getElementById(id);
    let lastData = null;
    let lastLiveId = 0;

    /* ---------- 工具 ---------- */
    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function countUp(el, target, duration) {
        const t = Number(target) || 0;
        const start = parseFloat(el.dataset.v) || 0;
        if (start === t) { el.textContent = fmtNum(t); el.dataset.v = t; return; }
        const dur = duration || 700;
        const t0 = performance.now();
        function step(now) {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmtNum(Math.round(start + (t - start) * eased));
            if (p < 1) requestAnimationFrame(step);
            else el.dataset.v = t;
        }
        requestAnimationFrame(step);
    }

    function fmtNum(n) {
        if (n >= 10000) return (n / 10000).toFixed(1) + "w";
        return String(n);
    }

    function setupCanvas(cv) {
        const dpr = window.devicePixelRatio || 1;
        const r = cv.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width * dpr));
        const h = Math.max(1, Math.round(r.height * dpr));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w: r.width, h: r.height };
    }

    /* ---------- 趋势图：柱状 + 折线 ---------- */
    function drawTrend(data) {
        const cv = $("chart-trend");
        if (!cv) return;
        const { ctx, w, h } = setupCanvas(cv);
        ctx.clearRect(0, 0, w, h);
        const days = data.trend || [];
        if (!days.length) return;

        const padL = 34, padR = 10, padT = 16, padB = 26;
        const max = Math.max(1, ...days.map((d) => d.count));
        const step = 4;
        const niceMax = Math.max(step, Math.ceil(max / step) * step);
        const innerW = w - padL - padR;
        const innerH = h - padT - padB;

        // 网格 + Y 刻度
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let i = 0; i <= 4; i++) {
            const v = (niceMax / 4) * i;
            const y = padT + innerH - (v / niceMax) * innerH;
            ctx.strokeStyle = "rgba(255,255,255,.06)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(w - padR, y);
            ctx.stroke();
            ctx.fillStyle = "rgba(139,147,167,.9)";
            ctx.fillText(String(Math.round(v)), padL - 6, y);
        }

        const n = days.length;
        const slot = innerW / n;
        const barW = Math.min(26, slot * 0.45);

        // 折线点
        const pts = days.map((d, i) => ({
            x: padL + slot * i + slot / 2,
            y: padT + innerH - (d.count / niceMax) * innerH,
            c: d.count,
        }));

        // 柱子
        for (let i = 0; i < n; i++) {
            const p = pts[i];
            const grad = ctx.createLinearGradient(0, p.y, 0, padT + innerH);
            grad.addColorStop(0, "#ec4141");
            grad.addColorStop(1, "rgba(236,65,65,.12)");
            ctx.fillStyle = grad;
            roundRect(ctx, p.x - barW / 2, p.y, barW, padT + innerH - p.y, 4);
            ctx.fill();
        }

        // 折线 + 发光点
        ctx.strokeStyle = "rgba(255,158,110,.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ff7e5f";
            ctx.shadowColor = "#ff7e5f";
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // X 轴日期
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(139,147,167,.9)";
        days.forEach((d, i) => {
            ctx.fillText(d.day, pts[i].x, padT + innerH + 8);
        });

        // 顶部数值
        ctx.fillStyle = "rgba(238,241,247,.85)";
        ctx.textBaseline = "bottom";
        pts.forEach((p) => {
            if (p.c > 0) ctx.fillText(String(p.c), p.x, p.y - 6);
        });
    }

    /* ---------- 24 小时分布 ---------- */
    function drawHour(data) {
        const cv = $("chart-hour");
        if (!cv) return;
        const { ctx, w, h } = setupCanvas(cv);
        ctx.clearRect(0, 0, w, h);
        const hours = data.today_hours || [];
        if (!hours.length) return;

        const padL = 26, padR = 6, padT = 14, padB = 18;
        const max = Math.max(1, ...hours);
        const innerW = w - padL - padR;
        const innerH = h - padT - padB;
        const n = hours.length;
        const slot = innerW / n;
        const barW = Math.max(2, slot * 0.6);
        const nowH = new Date().getHours();

        for (let i = 0; i < n; i++) {
            const v = hours[i];
            const bh = Math.max(2, (v / max) * innerH);
            const x = padL + slot * i + (slot - barW) / 2;
            const y = padT + innerH - bh;
            const isNow = i === nowH;
            ctx.fillStyle = isNow
                ? "#ec4141"
                : (v > 0 ? "rgba(77,124,255,.65)" : "rgba(255,255,255,.07)");
            roundRect(ctx, x, y, barW, bh, 2);
            ctx.fill();
            if (isNow) {
                ctx.shadowColor = "#ec4141";
                ctx.shadowBlur = 10;
                roundRect(ctx, x, y, barW, bh, 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // 关键刻度
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "rgba(139,147,167,.85)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        [0, 6, 12, 18, 23].forEach((i) => {
            ctx.fillText(String(i) + ":00", padL + slot * i + slot / 2, padT + innerH + 6);
        });
    }

    /* ---------- 情绪环形图 ---------- */
    const MOOD_COLORS = [
        "#ffd93d", "#4d7cff", "#23d3a8", "#ff6b3d",
        "#5cd6ff", "#ff7eb6", "#b48cff", "#7ddb6f",
        "#ffb74d", "#ff4d4f", "#6f7c8c", "#9aa5b1",
    ];

    function drawMood(data) {
        const cv = $("chart-mood");
        const center = $("mood-center-num");
        const legend = $("mood-legend");
        if (!cv) return;
        const { ctx, w, h } = setupCanvas(cv);
        ctx.clearRect(0, 0, w, h);
        const moods = data.moods || [];
        const total = moods.reduce((s, m) => s + (m[1] || 0), 0);
        if (center) center.textContent = total;

        // 图例
        if (legend) {
            legend.innerHTML = moods.map((m, i) => `
                <li>
                    <span class="dot" style="background:${MOOD_COLORS[i % MOOD_COLORS.length]}"></span>
                    <span class="lg-name">${escapeHtml(m[0])}</span>
                    <span class="lg-val">${m[1]} · ${total ? Math.round(m[1] / total * 100) : 0}%</span>
                </li>`).join("") ||
                `<li class="muted" style="grid-column:1/-1">暂无数据</li>`;
        }

        const size = Math.min(w, h);
        const cx = w / 2, cy = h / 2;
        const r = size / 2 - 8;
        const rIn = r * 0.66;

        if (!total) {
            ctx.strokeStyle = "rgba(255,255,255,.08)";
            ctx.lineWidth = r - rIn;
            ctx.beginPath();
            ctx.arc(cx, cy, (r + rIn) / 2, 0, Math.PI * 2);
            ctx.stroke();
            return;
        }

        let ang = -Math.PI / 2;
        moods.forEach((m, i) => {
            const frac = m[1] / total;
            const a2 = ang + frac * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, ang, a2);
            ctx.arc(cx, cy, rIn, a2, ang, true);
            ctx.closePath();
            ctx.fillStyle = MOOD_COLORS[i % MOOD_COLORS.length];
            ctx.fill();
            ang = a2;
        });
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

    /* ---------- 热歌榜 ---------- */
    function renderHot(data) {
        const el = $("hot-list");
        if (!el) return;
        const list = data.hot_songs || [];
        el.innerHTML = list.map((s, i) => `
            <li>
                <span class="rank-no ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">${i + 1}</span>
                <span class="hot-title">${escapeHtml(s.title)}</span>
                <span class="hot-artist">${escapeHtml(s.artist)}</span>
                <span class="hot-count">${s.play_count} 次</span>
            </li>`).join("") ||
            `<li class="live-empty">暂无播放数据</li>`;
    }

    /* ---------- 实时播放流（增量更新） ---------- */
    function renderLive(data, first) {
        const el = $("live-feed");
        if (!el) return;
        const feed = data.live_feed || [];
        if (!feed.length) {
            el.innerHTML = `<div class="live-empty">等待第一首播放…</div>`;
            return;
        }
        const newest = feed[0].id;
        if (!first && newest > lastLiveId) {
            // 有新增：只把新条目插到顶部并高亮
            const existing = new Set(
                Array.from(el.querySelectorAll(".live-item")).map((n) => Number(n.dataset.id))
            );
            const fresh = feed.filter((f) => !existing.has(f.id));
            const html = fresh.map((f) => liveItemHTML(f, true)).join("");
            if (html) {
                el.insertAdjacentHTML("afterbegin", html);
                const maxItems = 8;
                while (el.children.length > maxItems) el.removeChild(el.lastChild);
            }
        } else {
            el.innerHTML = feed.slice(0, 8).map((f) => liveItemHTML(f, false)).join("");
        }
        lastLiveId = newest;
    }

    function liveItemHTML(f, flash) {
        return `
        <div class="live-item${flash ? " flash" : ""}" data-id="${f.id}">
            <span class="live-dot"></span>
            <span class="live-song">《${escapeHtml(f.title)}》</span>
            <span class="live-artist">${escapeHtml(f.artist)}</span>
            <span class="live-time">${escapeHtml(f.ts)}</span>
            <span class="live-rel">${escapeHtml(f.relative)}</span>
        </div>`;
    }

    /* ---------- 汇总渲染 ---------- */
    function kpiEl(key) {
        // KPI 卡片无 id，按 data-kpi 定位数字元素（保留「首/分钟」等单位）
        return document.querySelector(`.kpi-value[data-kpi="${key}"] .num`);
    }

    function renderKpi(data) {
        const o = data.overview || {};
        const map = [
            ["total", o.total],
            ["today", o.today_count],
            ["hour", o.hour_count],
            ["unique", o.unique],
            ["top_hour", o.top_hour],
            ["minutes", o.minutes],
        ];
        map.forEach(([key, v]) => {
            const el = kpiEl(key);
            if (!el) return;
            // 字符串类指标（高频时段）直接显示，数值类走滚动动画
            if (typeof v === "string") {
                el.textContent = v;
                el.dataset.v = "0";
            } else {
                countUp(el, v);
            }
        });
    }

    function renderAll(data, first) {
        lastData = data;
        if (data.empty) {
            $("dash-empty").style.display = "flex";
            return;
        }
        $("dash-empty").style.display = "none";
        renderKpi(data);
        drawTrend(data);
        drawHour(data);
        drawMood(data);
        renderHot(data);
        renderLive(data, first);
    }

    /* ---------- 时钟 ---------- */
    function tickClock() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        $("dash-time").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        $("dash-date").textContent =
            `${now.getFullYear()} 年 ${pad(now.getMonth() + 1)} 月 ${pad(now.getDate())} 日 · 星期${"日一二三四五六"[now.getDay()]}`;
    }

    /* ---------- 轮询 ---------- */
    let firstLoad = true;
    async function refresh() {
        try {
            const resp = await fetch(API_URL);
            if (!resp.ok) throw new Error("请求失败");
            const data = await resp.json();
            renderAll(data, firstLoad);
            firstLoad = false;
        } catch (e) {
            // 静默重试，避免大屏闪错误
        }
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (lastData) {
                drawTrend(lastData);
                drawHour(lastData);
                drawMood(lastData);
            }
        }, 200);
    });

    window.addEventListener("DOMContentLoaded", () => {
        tickClock();
        setInterval(tickClock, 1000);
        refresh();
        setInterval(refresh, POLL_MS);
        initFullscreen();
    });

    /* ---------- 全屏 / 内嵌适配 ---------- */
    function initFullscreen() {
        // 被播放器 iframe 内嵌时，隐藏「返回播放器」，避免套娃跳转
        if (window.self !== window.top) {
            const back = document.getElementById("dash-back");
            if (back) back.style.display = "none";
        }
        const fsBtn = document.getElementById("dash-fullscreen");
        if (!fsBtn) return;
        const setLabel = () => {
            fsBtn.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
        };
        fsBtn.addEventListener("click", () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        });
        document.addEventListener("fullscreenchange", setLabel);
    }
})();
