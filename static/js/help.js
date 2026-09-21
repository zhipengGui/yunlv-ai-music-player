/* ========== 帮助中心（使用技巧 / 隐藏玩法 / 关于） ==========
 * 侧边栏「帮助」入口打开，随时可重复查看；
 * 键盘快捷键面板沿用 shortcuts.js（? 键），此处只做跳转，避免内容双维护。
 */
(function () {
    "use strict";
    const modal = document.getElementById("help-modal");
    if (!modal) return;

    // 全局函数供模板内联 onclick 使用（与 theme.js 风格一致）
    function openHelpModal() { modal.style.display = "flex"; }
    function closeHelpModal() { modal.style.display = "none"; }

    // 侧边栏入口 + 图标
    const navBtn = document.getElementById("help-btn");
    if (navBtn) {
        const slot = navBtn.querySelector(".nav-ic");
        if (slot) slot.innerHTML = ic("help", 17);
        navBtn.addEventListener("click", openHelpModal);
    }

    // 点击遮罩关闭
    modal.addEventListener("click", (e) => { if (e.target === modal) closeHelpModal(); });

    // Tab 切换
    const tabs = Array.prototype.slice.call(modal.querySelectorAll(".help-tab"));
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.toggle("active", t === tab));
            modal.querySelectorAll(".help-panel").forEach((p) => p.classList.remove("active"));
            const panel = document.getElementById("help-panel-" + tab.dataset.help);
            if (panel) panel.classList.add("active");
        });
    });

    // 打开键盘快捷键面板（内容由 shortcuts.js 维护，入口唯一）
    const scBtn = document.getElementById("help-shortcut-btn");
    if (scBtn) scBtn.addEventListener("click", () => {
        closeHelpModal();
        if (window.Shortcuts) Shortcuts.openHelp();
    });

    // 重新播放新手引导
    const rpBtn = document.getElementById("help-replay-btn");
    if (rpBtn) rpBtn.addEventListener("click", () => {
        closeHelpModal();
        if (window.Onboard) Onboard.replay();
    });

    // IIFE 内函数不会自动全局，需显式挂载供模板内联 onclick 调用
    window.openHelpModal = openHelpModal;
    window.closeHelpModal = closeHelpModal;
    window.Help = { open: openHelpModal, close: closeHelpModal };
})();
