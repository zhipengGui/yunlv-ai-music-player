/* ========== 主题换肤 ==========
 * 7 套预设主题，通过 <html data-theme="..."> 切换 CSS 变量实现全站换肤
 * 选择结果存 localStorage，启动时由 head 内联脚本提前恢复（防闪烁）
 */
const THEME_KEY = "yunlu_theme";
const THEMES = [
    { key: "azure",   name: "云律蓝紫", grad: "linear-gradient(135deg,#5b8cff,#a78bfa)", meta: "#5b8cff" },
    { key: "netease", name: "网易云红", grad: "linear-gradient(135deg,#ec4141,#ff7e5f)", meta: "#ec4141" },
    { key: "cyan",    name: "电光青",   grad: "linear-gradient(135deg,#3fd6ff,#6ee7ff)", meta: "#3fd6ff" },
    { key: "lime",    name: "青柠绿",   grad: "linear-gradient(135deg,#3ddc84,#7ce38b)", meta: "#3ddc84" },
    { key: "amber",   name: "暖橙",     grad: "linear-gradient(135deg,#ff8a3d,#ffb35c)", meta: "#ff8a3d" },
    { key: "rose",    name: "玫瑰粉",   grad: "linear-gradient(135deg,#f472b6,#ff9ecf)", meta: "#f472b6" },
    { key: "gold",    name: "黑金",     grad: "linear-gradient(135deg,#d4af37,#f5e08a)", meta: "#d4af37" },
];

function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) || "azure"; } catch (e) { return "azure"; }
}

/* 同步浏览器地址栏 / 状态栏颜色（移动端 PWA 标签页） */
function syncThemeMeta(key) {
    const t = THEMES.find((x) => x.key === key) || THEMES[0];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.meta);
}

function applyTheme(key) {
    document.documentElement.setAttribute("data-theme", key);
    try { localStorage.setItem(THEME_KEY, key); } catch (e) { /* 忽略 */ }
    syncThemeMeta(key);
    const grid = document.getElementById("theme-grid");
    if (grid) {
        grid.querySelectorAll(".theme-swatch").forEach((s) => {
            s.classList.toggle("active", s.dataset.key === key);
        });
    }
}

function openThemeModal() {
    document.getElementById("theme-modal").style.display = "flex";
}

function closeThemeModal() {
    document.getElementById("theme-modal").style.display = "none";
}

function renderThemeGrid() {
    const grid = document.getElementById("theme-grid");
    if (!grid) return;
    const cur = currentTheme();
    THEMES.forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-swatch" + (t.key === cur ? " active" : "");
        btn.dataset.key = t.key;
        btn.title = t.name;
        btn.innerHTML = `<span class="theme-dot" style="background:${t.grad}"></span><span class="theme-name">${t.name}</span>`;
        btn.addEventListener("click", () => applyTheme(t.key));
        grid.appendChild(btn);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.addEventListener("click", openThemeModal);
    renderThemeGrid();
    syncThemeMeta(currentTheme());
});
