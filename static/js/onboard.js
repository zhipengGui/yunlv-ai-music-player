/* ========== 新手引导气泡 ==========
 * 首次打开自动弹出聚光灯引导（3 步，高亮关键区域）；
 * 之后可在「帮助 / 设置」里点按钮随时重播（Onboard.replay）。
 * 跳过或走完即写 yunlu.onboard.done，不再自动打扰。
 */
(function () {
    "use strict";
    const DONE_KEY = "yunlu.onboard.done";

    const STEPS = [
        {
            icon: "🤖",
            title: "一句话点歌",
            target: "#mood-input",
            placement: "bottom",
            desc: "在顶部输入你的心情，比如「今天加班好累，想听点治愈的纯音乐」，点「AI 点歌」。点歌后还能继续追问：「换一首更舒缓的」也可以。",
        },
        {
            icon: "🎤",
            title: "也可以直接说",
            target: "#voice-btn",
            placement: "bottom",
            desc: "点顶栏的麦克风说「来点周小云的歌」就能直接播放。语音识别需要 Chrome / Edge 浏览器；旁边的快捷点歌按钮任何浏览器都能用。",
        },
        {
            icon: "✨",
            title: "还有这些玩法",
            target: ".player-right",
            placement: "top",
            desc: "均衡器、实时频谱、定时关闭都在播放条右侧。歌曲卡片上点右键可以收藏 / 加入歌单，按 ? 可随时查看全部快捷键。以后想复习，点侧边栏「帮助」或「设置」里的重播按钮即可。",
        },
    ];

    let step = 0;
    let running = false;
    let overlay = null;
    let spot = null;
    let pop = null;

    function doneFlag() {
        try { return localStorage.getItem(DONE_KEY) === "1"; } catch (e) { return false; }
    }
    function markDone() {
        try { localStorage.setItem(DONE_KEY, "1"); } catch (e) { /* ignore */ }
    }

    function build() {
        if (overlay) return;
        overlay = document.createElement("div");
        overlay.className = "tour-overlay";
        overlay.innerHTML = `
            <div class="tour-spot"></div>
            <div class="tour-pop">
                <div class="tour-progress" data-el="progress"></div>
                <div class="tour-title" data-el="title"></div>
                <div class="tour-desc" data-el="desc"></div>
                <div class="tour-actions">
                    <button type="button" class="tour-btn ghost" data-el="skip">跳过</button>
                    <span class="tour-spacer"></span>
                    <button type="button" class="tour-btn ghost" data-el="full">完整教程</button>
                    <button type="button" class="tour-btn primary" data-el="next">下一步</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        spot = overlay.querySelector(".tour-spot");
        pop = overlay.querySelector(".tour-pop");

        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) stop(false); });
        overlay.querySelector('[data-el="skip"]').addEventListener("click", () => stop(false));
        overlay.querySelector('[data-el="full"]').addEventListener("click", () => {
            stop(true);
            if (window.Help) Help.open();
        });
        overlay.querySelector('[data-el="next"]').addEventListener("click", nextStep);
        window.addEventListener("resize", layout);
        window.addEventListener("scroll", layout, true); // 内容滚动时保持高亮跟随
    }

    function render() {
        if (!running) return;
        const s = STEPS[step];
        overlay.querySelector('[data-el="title"]').innerHTML = `<span class="tour-ic">${s.icon}</span> ${s.title}`;
        overlay.querySelector('[data-el="desc"]').textContent = s.desc;
        overlay.querySelector('[data-el="progress"]').innerHTML =
            STEPS.map((_, i) => `<span class="dot${i <= step ? " on" : ""}"></span>`).join("");
        const nextBtn = overlay.querySelector('[data-el="next"]');
        nextBtn.textContent = step === STEPS.length - 1 ? "完成，开始听歌" : "下一步";
        layout();
    }

    function layout() {
        if (!running) return;
        overlay.style.display = "block";
        const s = STEPS[step];
        const target = s.target ? document.querySelector(s.target) : null;
        if (!target || !target.getBoundingClientRect) {
            spot.style.display = "none";
            pop.style.left = Math.max(12, (window.innerWidth - 320) / 2) + "px";
            pop.style.top = "96px";
            pop.style.display = "block";
            return;
        }
        const r = target.getBoundingClientRect();
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        // 高亮框（目标外扩 6px）
        spot.style.display = "block";
        spot.style.left = (r.left - 6) + "px";
        spot.style.top = (r.top - 6) + "px";
        spot.style.width = (r.width + 12) + "px";
        spot.style.height = (r.height + 12) + "px";

        // 气泡：默认放目标下侧，放不下自动换到上侧；居中水平不越界
        const pw = 320;
        const ph = pop.offsetHeight || 180;
        let x = Math.max(12, Math.min(r.left + r.width / 2 - pw / 2, viewW - pw - 12));
        let y;
        if (s.placement === "top") {
            y = r.top - ph - 14;
            if (y < 12 && r.bottom + ph + 14 < viewH) y = r.bottom + 14;
            y = Math.max(12, y);
        } else {
            y = r.bottom + 14;
            if (y + ph > viewH - 12 && r.top - ph - 14 > 0) y = r.top - ph - 14;
            y = Math.max(12, Math.min(y, viewH - ph - 12));
        }
        pop.style.left = x + "px";
        pop.style.top = y + "px";
        pop.style.display = "block";
    }

    function nextStep() {
        if (step < STEPS.length - 1) {
            step += 1;
            render();
        } else {
            stop(true);
        }
    }

    function stop(completed) {
        if (!running) return;
        running = false;
        overlay.style.display = "none";
        window.removeEventListener("resize", layout);
        window.removeEventListener("scroll", layout, true);
        markDone();
        if (completed && window.player && player._toast) player._toast("引导已完成，随时可从侧边栏「帮助」复习");
    }

    function start(force) {
        // 窄屏不适合聚光灯引导（CSS 中 ≤900px 隐藏侧边栏），自动跳过
        if (window.innerWidth <= 900) return;
        if (running) return;
        if (!force && doneFlag()) return;
        build();
        step = 0;
        running = true;
        render();
    }

    function replay() {
        try { localStorage.removeItem(DONE_KEY); } catch (e) { /* ignore */ }
        start(true);
    }

    // 首次访问：等页面与数据就绪后再自动出现
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => setTimeout(() => start(false), 1000));
    } else {
        setTimeout(() => start(false), 1000);
    }

    window.Onboard = { start, replay };
})();
