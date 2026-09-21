/* ========== 板块4 歌词同步 ==========
 * - 监听 songchange 事件加载歌词
 * - LRC 解析：[mm:ss.xx] 歌词内容
 * - 监听 timeupdate 对比时间戳，高亮当前行并自动滚动居中
 */
let lyricLines = [];        // [{time, text}]
let currentLyricIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
    bindLyricToggle();
    window.addEventListener("songchange", (e) => {
        const song = e.detail.song;
        loadLyrics(song);
    });
    // 播放时间更新 -> 歌词高亮
    window.player.audio.addEventListener("timeupdate", () => {
        if (!lyricLines.length) return;
        const t = window.player.audio.currentTime;
        let idx = -1;
        for (let i = 0; i < lyricLines.length; i++) {
            if (t >= lyricLines[i].time) idx = i;
            else break;
        }
        if (idx !== currentLyricIndex) {
            currentLyricIndex = idx;
            highlightLyric(idx);
        }
    });
});

/* ---------- 加载歌词 ---------- */
async function loadLyrics(song) {
    const panel = document.getElementById("lyric-panel");
    const linesEl = document.getElementById("lyric-lines");
    lyricLines = [];
    currentLyricIndex = -1;

    if (!song || !song.id) {
        linesEl.innerHTML = `<div class="lyric-empty">在线歌曲暂无歌词</div>`;
        return;
    }
    linesEl.innerHTML = `<div class="lyric-empty">加载歌词…</div>`;
    try {
        const d = await API.get(`/api/lyrics/${song.id}/`);
        if (!d.has_lrc) {
            linesEl.innerHTML = `<div class="lyric-empty">暂无歌词</div>`;
            return;
        }
        lyricLines = parseLRC(d.lrc);
        if (!lyricLines.length) {
            linesEl.innerHTML = `<div class="lyric-empty">暂无歌词</div>`;
            document.dispatchEvent(new CustomEvent("lyricloaded"));
            return;
        }
        linesEl.innerHTML = lyricLines.map((l, i) =>
            `<div class="lyric-line" data-idx="${i}">${escapeHtml(l.text)}</div>`).join("");
        // 通知情绪曲线模块：歌词已就绪
        document.dispatchEvent(new CustomEvent("lyricloaded"));
        // 面板自动展开
        if (panel.style.display === "none") toggleLyricPanel();
    } catch (e) {
        linesEl.innerHTML = `<div class="lyric-empty">歌词加载失败</div>`;
    }
}

/* ---------- LRC 解析 ---------- */
function parseLRC(text) {
    const lines = [];
    const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)/;
    for (const raw of String(text).split("\n")) {
        const line = raw.replace(/\r/g, "");
        let m = re.exec(line);
        while (m) {
            const minutes = parseInt(m[1], 10);
            const seconds = parseInt(m[2], 10);
            const fracStr = m[3] || "0";
            // 毫秒：1-3 位
            const frac = parseInt(fracStr.padEnd(3, "0").slice(0, 3), 10) / 1000;
            const time = minutes * 60 + seconds + frac;
            const text = (m[4] || "").trim();
            if (text) lines.push({ time, text });
            // 一行内可能多个时间戳
            m = re.exec(line.slice(m.index + m[0].length));
        }
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
}

/* ---------- 高亮 + 滚动 ---------- */
function highlightLyric(idx) {
    const linesEl = document.getElementById("lyric-lines");
    const rows = linesEl.querySelectorAll(".lyric-line");
    rows.forEach((r, i) => r.classList.toggle("active", i === idx));
    if (idx >= 0 && rows[idx]) {
        // 居中滚动
        const lineEl = rows[idx];
        const container = document.querySelector(".lyric-panel .lyric-scroll");
        if (container) {
            const target = lineEl.offsetTop + lineEl.offsetHeight / 2 - container.clientHeight / 2;
            container.scrollTo({ top: target, behavior: "smooth" });
        }
    }
}

/* ---------- 面板开关 ---------- */
function bindLyricToggle() {
    const btn = document.getElementById("btn-lyric");
    if (btn) btn.addEventListener("click", toggleLyricPanel);
    const close = document.getElementById("lyric-close");
    if (close) close.addEventListener("click", toggleLyricPanel);
}

function toggleLyricPanel() {
    const panel = document.getElementById("lyric-panel");
    const show = panel.style.display === "none";
    panel.style.display = show ? "block" : "none";
    if (show) {
        // 通知其他模块（如歌词情绪曲线）面板已显示，可安全获取尺寸并重绘
        document.dispatchEvent(new CustomEvent("lyricpanelopen"));
        // 重新居中当前行
        if (currentLyricIndex >= 0) highlightLyric(currentLyricIndex);
    }
}

/* 供其他模块（海报等）访问 */
window.lyricLines = () => lyricLines;
window.currentLyricIndex = () => currentLyricIndex;
