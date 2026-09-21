/* ========== 板块8 · 听歌报告 & 点歌排行榜 ========== */
(function () {
    "use strict";

    window.loadReport = loadReport;

    function loadReport() {
        const tab = document.querySelector(".report-tab.active");
        if (tab && tab.dataset.tab === "leaderboard") {
            loadLeaderboard();
        } else {
            loadSummary();
        }
    }

    /* ---------- 听歌报告 ---------- */
    function loadSummary() {
        const panel = document.getElementById("report-panel");
        panel.innerHTML = `<div class="empty-hint">正在生成你的听歌报告…</div>`;
        API.reportSummary().then((d) => {
            if (d.empty) {
                panel.innerHTML = `<div class="empty-hint">${d.message}</div>`;
                return;
            }
            panel.innerHTML = reportHTML(d);
        }).catch((e) => {
            panel.innerHTML = `<div class="empty-hint">加载失败：${e.message}</div>`;
        });
    }

    function reportHTML(d) {
        const styleBars = (d.styles || []).map(([k, v]) => bar(k, v, d.total)).join("");
        const moodBars = (d.moods || []).map(([k, v]) => bar(k, v, d.total)).join("");
        const maxDay = Math.max(1, ...(d.daily || []).map((x) => x.count));
        const dailyBars = (d.daily || []).map((x) => bar(x.day, x.count, maxDay)).join("");
        const periods = d.periods || {};
        const periodText = ["上午", "下午", "晚上"]
            .map((p) => `${p} ${periods[p] || 0} 首`).join(" · ");

        return `
        <div class="report-hero">
            <div class="rh-num">${d.total}</div>
            <div class="rh-label">累计播放 ${d.total} 首 · 约 ${d.minutes} 分钟 · 不重样 ${d.unique} 首</div>
            <div class="rh-sub">今天已听 ${d.today_count} 首</div>
        </div>
        <div class="report-grid">
            <div class="report-card">
                <div class="rc-title">${ic("repeat", 12)} 单曲循环王</div>
                <div class="rc-big">《${d.top_song}》</div>
                <div class="rc-sub">听了 ${d.top_song_times} 次</div>
            </div>
            <div class="report-card">
                <div class="rc-title">${ic("headphones", 12)} 最爱风格</div>
                <div class="rc-big">${d.top_style}</div>
                <div class="rc-sub">心情主打：${d.top_mood}</div>
            </div>
            <div class="report-card">
                <div class="rc-title">${ic("clock", 12)} 高频时段</div>
                <div class="rc-big">${d.top_period}</div>
                <div class="rc-sub">${periodText}</div>
            </div>
            <div class="report-card">
                <div class="rc-title">${ic("flame", 12)} 最近播放</div>
                <div class="rc-big">《${d.latest.title}》</div>
                <div class="rc-sub">${d.latest.artist} · ${d.latest.ts}</div>
            </div>
        </div>
        ${d.styles && d.styles.length ? `<div class="report-card wide">
            <div class="rc-title">风格分布</div>${styleBars}</div>` : ""}
        ${d.moods && d.moods.length ? `<div class="report-card wide">
            <div class="rc-title">情绪偏好</div>${moodBars}</div>` : ""}
        ${d.daily && d.daily.length ? `<div class="report-card wide">
            <div class="rc-title">近 7 天播放趋势</div>${dailyBars}</div>` : ""}`;
    }

    function bar(label, value, max) {
        const w = Math.max(3, Math.round((value / max) * 100));
        return `
        <div class="bar-row">
            <span class="bar-label">${escapeHtml(label)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
            <span class="bar-value">${value}</span>
        </div>`;
    }

    /* ---------- 点歌排行榜 ---------- */
    function loadLeaderboard() {
        const panel = document.getElementById("leaderboard-panel");
        panel.innerHTML = `<div class="empty-hint">加载中…</div>`;
        API.reportLeaderboard().then((d) => {
            if (!d.leaderboard || !d.leaderboard.length) {
                panel.innerHTML = `<div class="empty-hint">还没有点歌记录，快去播放几首吧！</div>`;
                return;
            }
            panel.innerHTML = d.leaderboard.map((r, i) => `
            <div class="rank-row" data-idx="${i}" title="点击播放">
                <span class="rank-no ${i < 3 ? "top" : ""}">${i + 1}</span>
                <span class="rank-title">${escapeHtml(r.title)}</span>
                <span class="rank-artist">${escapeHtml(r.artist || "未知")}</span>
                <span class="rank-tag">${escapeHtml(r.genre || "")}</span>
                <span class="rank-count">${r.play_count} 次</span>
            </div>`).join("");
            panel.querySelectorAll(".rank-row").forEach((row) => {
                row.addEventListener("click", () => {
                    window.player.loadQueue(d.leaderboard);
                    window.player.playAtIndex(parseInt(row.dataset.idx, 10));
                });
            });
        }).catch((e) => {
            panel.innerHTML = `<div class="empty-hint">加载失败：${e.message}</div>`;
        });
    }

    /* ---------- 切换 Tab ---------- */
    document.querySelectorAll(".report-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".report-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            const isRank = tab.dataset.tab === "leaderboard";
            document.getElementById("report-panel").style.display = isRank ? "none" : "block";
            document.getElementById("leaderboard-panel").style.display = isRank ? "block" : "none";
            if (isRank) {
                loadLeaderboard();
            } else {
                loadSummary();
            }
        });
    });

    const refreshBtn = document.getElementById("btn-refresh-report");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadReport);
    }
})();
