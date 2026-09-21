/* ========== 设置面板 ==========
 * 侧边栏「设置」入口打开，集中展示已有偏好（主题 / 动态背景 / 均衡器 /
 * 频谱 / 播放模式），全部复用各模块暴露的 API，不新增存储逻辑。
 */
(function () {
    "use strict";
    const modal = document.getElementById("settings-modal");
    if (!modal) return;
    const $ = (id) => document.getElementById(id);

    const MODE_LABELS = { order: "顺序播放", repeat: "单曲循环", shuffle: "随机播放" };

    // 全局函数供模板内联 onclick 使用（与 theme.js 风格一致）
    function openSettingsModal() {
        modal.style.display = "flex";
        syncThemes();
        syncAmbient();
        syncEq();
        syncMode();
        syncSpectrum();
    }
    function closeSettingsModal() { modal.style.display = "none"; }

    // 侧边栏入口 + 图标
    const navBtn = document.getElementById("settings-btn");
    if (navBtn) {
        const slot = navBtn.querySelector(".nav-ic");
        if (slot) slot.innerHTML = ic("settings", 17);
        navBtn.addEventListener("click", openSettingsModal);
    }
    modal.addEventListener("click", (e) => { if (e.target === modal) closeSettingsModal(); });

    /* ---------- 主题配色 ---------- */
    function syncThemes() {
        const wrap = $("setting-themes");
        if (!wrap || !window.THEMES) return;
        wrap.innerHTML = "";
        const cur = typeof currentTheme === "function" ? currentTheme() : "azure";
        THEMES.forEach((t) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "theme-dot-btn" + (t.key === cur ? " active" : "");
            dot.style.background = t.grad;
            dot.title = t.name;
            dot.addEventListener("click", () => {
                if (typeof applyTheme === "function") applyTheme(t.key);
                wrap.querySelectorAll(".theme-dot-btn").forEach((b) => b.classList.toggle("active", b === dot));
            });
            wrap.appendChild(dot);
        });
    }

    /* ---------- 动态氛围背景 ---------- */
    const ambientCk = $("setting-ambient");
    function syncAmbient() {
        if (ambientCk && window.AmbientBG) ambientCk.checked = AmbientBG.isOn();
    }
    if (ambientCk) {
        ambientCk.addEventListener("change", () => {
            if (window.AmbientBG) AmbientBG.set(ambientCk.checked);
        });
    }

    /* ---------- 均衡器预设 ---------- */
    const eqWrap = $("setting-eq");
    function syncEq() {
        if (!eqWrap || !window.EQ) return;
        eqWrap.innerHTML = "";
        Object.keys(EQ.presets).forEach((k) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip" + (k === EQ.get() ? " active" : "");
            chip.textContent = EQ.presets[k].label;
            chip.dataset.eq = k;
            eqWrap.appendChild(chip);
        });
        const cur = $("eq-current-name");
        if (cur) cur.textContent = EQ.presets[EQ.get()].label;
    }
    if (eqWrap) {
        eqWrap.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip || !window.EQ) return;
            EQ.set(chip.dataset.eq);
            syncEq();
        });
    }

    /* ---------- 播放模式 ---------- */
    const modeWrap = $("setting-mode");
    function syncMode() {
        if (!modeWrap) return;
        const p = window.player;
        const cur = p && p.mode ? p.mode : "order";
        modeWrap.innerHTML = "";
        Object.keys(MODE_LABELS).forEach((k) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip" + (k === cur ? " active" : "");
            chip.textContent = MODE_LABELS[k];
            chip.dataset.mode = k;
            modeWrap.appendChild(chip);
        });
        const nameEl = $("mode-current-name");
        if (nameEl) nameEl.textContent = MODE_LABELS[cur];
    }
    if (modeWrap) {
        modeWrap.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip || !window.player || typeof player.setMode !== "function") return;
            player.setMode(chip.dataset.mode);
            syncMode();
        });
    }

    /* ---------- 频谱条默认状态（勾选 = 默认展开） ---------- */
    const spCk = $("setting-spectrum");
    function syncSpectrum() {
        if (spCk && window.SpectrumBar) spCk.checked = !SpectrumBar.isMinimized();
    }
    if (spCk) {
        spCk.addEventListener("change", () => {
            if (window.SpectrumBar) SpectrumBar.setMinimized(!spCk.checked);
        });
    }

    /* ---------- 新手引导重播 ---------- */
    const rpBtn = $("setting-replay");
    if (rpBtn) {
        rpBtn.addEventListener("click", () => {
            closeSettingsModal();
            if (window.Onboard) Onboard.replay();
        });
    }

    // IIFE 内函数不会自动全局，需显式挂载供模板内联 onclick 调用
    window.openSettingsModal = openSettingsModal;
    window.closeSettingsModal = closeSettingsModal;
    window.Settings = { open: openSettingsModal, close: closeSettingsModal };
})();
