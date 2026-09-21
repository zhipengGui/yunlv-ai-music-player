/* ========== 板块5 每日推荐 ========== */
window.loadRecommend = loadRecommend;

async function loadRecommend() {
    const container = document.getElementById("recommend-list");
    const hint = document.getElementById("recommend-hint");
    container.innerHTML = `<div class="empty-hint">生成推荐中…</div>`;
    hint.style.display = "none";
    try {
        const d = await API.get("/api/recommend/daily/");
        const songs = d.songs;
        const reasons = d.reasons || {};
        if (!songs.length) {
            container.innerHTML = "";
            hint.innerHTML = `<p>曲库为空，推荐无法生成</p>`;
            hint.style.display = "block";
            return;
        }
        container.innerHTML = `
            <div class="recommend-grid">
                ${songs.map((s, i) => `
                    <div class="recommend-card" onclick="playRecommend(${i})">
                        <div class="rec-cover" style="${CoverGen.inlineStyle(s)}">
                            ${s.cover ? `<img src="${s.cover}" alt="">` : `<span>♫</span>`}
                            <span class="rec-play">${ic("play", 12)}</span>
                        </div>
                        <div class="rec-title">${escapeHtml(s.title)}</div>
                        <div class="rec-artist muted">${escapeHtml(s.artist || "未知")}</div>
                        ${reasons[s.id] ? `<div class="rec-reason">${ic("sparkles", 11)} ${escapeHtml(reasons[s.id])}</div>` : ""}
                    </div>`).join("")
                }
            </div>`;
        // 加入播放队列
        const queued = songs.map((s) => ({ ...s, stream_url: s.id ? API.streamUrl(s.id) : s.stream_url }));
        window.player.loadQueue(queued);
        window._currentQueue = queued;
    } catch (e) {
        container.innerHTML = `<div class="empty-hint">推荐加载失败：${e.message}</div>`;
    }
}

function playRecommend(i) {
    window.player.playAtIndex(i);
}
