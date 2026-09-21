/* ========== 云律 AI 均衡器 ==========
 * 6 个预设（关闭/流行/摇滚/低音/人声/古典/原声），作用于 5 频段
 * 实际音频处理在 spectrum.js 的音频图里（window.__audioGraph.setEq）
 */
(function () {
    "use strict";
    const STORE_KEY = "yunly.eq.preset";

    // 5 频段增益（dB）：低架250 / 峰值500 / 1k / 3k / 高架8k
    const EQ_PRESETS = {
        off:       { label: "关闭", gains: [0, 0, 0, 0, 0] },
        pop:       { label: "流行", gains: [-1, 2, 3, 2, -1] },
        rock:      { label: "摇滚", gains: [4, 2, -1, 2, 4] },
        bass:      { label: "低音", gains: [6, 3, 0, -1, -1] },
        vocal:     { label: "人声", gains: [-1, 0, 3, 3, 1] },
        classical: { label: "古典", gains: [-2, -1, 1, 2, 3] },
        acoustic:  { label: "原声", gains: [-1, 1, 2, 1, -1] },
    };

    const btn = document.getElementById("btn-eq");
    if (!btn) return;
    btn.innerHTML = ic("sliders", 16);
    btn.title = "均衡器";

    const panel = document.createElement("div");
    panel.className = "eq-panel";
    panel.innerHTML = `
        <div class="eq-title">均衡器</div>
        <div class="eq-presets">
            ${Object.keys(EQ_PRESETS).map((k) => `<button class="eq-preset" data-eq="${k}">${EQ_PRESETS[k].label}</button>`).join("")}
        </div>`;
    document.body.appendChild(panel);

    let current = "off";
    try { current = localStorage.getItem(STORE_KEY) || "off"; } catch (e) { /* ignore */ }
    if (!EQ_PRESETS[current]) current = "off";

    function apply() {
        if (window.__audioGraph) window.__audioGraph.setEq(EQ_PRESETS[current].gains);
        panel.querySelectorAll(".eq-preset").forEach((b) => {
            b.classList.toggle("active", b.dataset.eq === current);
        });
        btn.classList.toggle("active", current !== "off");
        btn.title = current === "off" ? "均衡器" : `均衡器 · ${EQ_PRESETS[current].label}`;
        try { localStorage.setItem(STORE_KEY, current); } catch (e) { /* ignore */ }
    }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("open");
    });
    panel.querySelectorAll(".eq-preset").forEach((b) => {
        b.addEventListener("click", () => {
            current = b.dataset.eq;
            apply();
        });
    });
    document.addEventListener("click", (e) => {
        if (panel.classList.contains("open") && !panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove("open");
        }
    });

    apply();

    /* ---------- 设置面板控制接口 ---------- */
    window.EQ = {
        presets: EQ_PRESETS,
        get: () => current,
        set(key) {
            if (EQ_PRESETS[key] && key !== current) {
                current = key;
                apply();
            }
        },
    };
})();
