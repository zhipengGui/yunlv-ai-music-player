/* ========== 云律 AI 定时关闭 ==========
 * 15 / 30 / 60 分钟 或 播完当前曲；到点音量淡出后暂停
 * 协调：player.js 的 ended 事件里调用 window.__stopAfterEnd()，
 * 返回 true 表示拦截自动切歌（"播完当前曲"模式）
 */
(function () {
    "use strict";
    const btn = document.getElementById("btn-timer");
    if (!btn) return;
    btn.innerHTML = ic("clock", 16);
    btn.title = "定时关闭";

    const panel = document.createElement("div");
    panel.className = "timer-panel";
    panel.innerHTML = `
        <div class="timer-title">定时关闭</div>
        <div class="timer-opts">
            <button data-min="15">15 分钟</button>
            <button data-min="30">30 分钟</button>
            <button data-min="60">60 分钟</button>
            <button data-end="1">播完当前曲</button>
        </div>
        <button class="timer-cancel">取消定时</button>`;
    document.body.appendChild(panel);

    let timerId = null;      // 到点主定时器
    let tickId = null;       // 每秒倒计时
    let mode = null;         // "min" 分钟 / "end" 播完当前曲
    let remain = 0;          // 剩余秒（分钟模式）

    function cancel() {
        clearTimeout(timerId);
        clearInterval(tickId);
        timerId = tickId = null;
        mode = null;
        remain = 0;
        btn.classList.remove("active");
        btn.title = "定时关闭";
        panel.querySelector(".timer-cancel").style.display = "none";
        // 恢复用户音量（淡出可能改变了 audio.volume）
        if (window.player) window.player.audio.volume = window.player.volume;
    }

    function fadeOutAndPause() {
        const p = window.player;
        if (!p || !p.audio) return;
        const base = p.volume;
        if (base <= 0) { p.audio.pause(); return; }
        const step = base / 18; // 约 1.8 秒淡出
        const fade = setInterval(() => {
            const v = Math.max(0, p.audio.volume - step);
            p.audio.volume = v;
            if (v <= 0) {
                clearInterval(fade);
                p.audio.pause();
                if (p._toast) p._toast("定时关闭：已停止播放");
            }
        }, 100);
    }

    function stop() {
        cancel();
        fadeOutAndPause();
    }

    function startMin(minutes) {
        cancel();
        mode = "min";
        remain = minutes * 60;
        btn.classList.add("active");
        panel.querySelector(".timer-cancel").style.display = "block";
        tickId = setInterval(() => {
            remain--;
            btn.title = `定时关闭 ${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`;
            if (remain <= 0) stop();
        }, 1000);
        timerId = setTimeout(stop, minutes * 60 * 1000);
        panel.classList.remove("open");
    }

    function startEnd() {
        cancel();
        mode = "end";
        btn.classList.add("active");
        btn.title = "播完当前曲后关闭";
        panel.querySelector(".timer-cancel").style.display = "block";
        panel.classList.remove("open");
    }

    // 供 player.js 的 ended 事件调用：true = 拦截自动切歌
    window.__stopAfterEnd = function () {
        if (mode === "end") {
            stop();
            return true;
        }
        return false;
    };

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("open");
    });
    panel.querySelectorAll("[data-min]").forEach((b) => {
        b.addEventListener("click", () => startMin(parseInt(b.dataset.min, 10)));
    });
    panel.querySelector("[data-end]").addEventListener("click", startEnd);
    panel.querySelector(".timer-cancel").addEventListener("click", cancel);
    document.addEventListener("click", (e) => {
        if (panel.classList.contains("open") && !panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove("open");
        }
    });
})();
