/* ========== 云律 AI 封面生成器 ==========
 * 根据曲风/标题为每首歌生成专属渐变封面（大厂封面墙效果）
 * 用 CSS 变量 + 内联样式实现，零图片资源、零内存负担
 * 用法：
 *   CoverGen.html(song, "song-cover")  -> 封面 HTML 字符串
 *   CoverGen.styleVars(song)           -> CSS 变量对象
 */
const CoverGen = (function () {
    "use strict";

    // 曲风 -> 双色渐变（大厂风，鲜艳协调）
    const palettes = {
        pop:        ["#f6416c", "#ff8a5c"],
        rock:       ["#6d28d9", "#a855f7"],
        electronic: ["#0ea5e9", "#6366f1"],
        hiphop:     ["#f59e0b", "#f43f5e"],
        rnb:        ["#8b5cf6", "#ec4899"],
        folk:       ["#10b981", "#84cc16"],
        classical:  ["#64748b", "#94a3b8"],
        jazz:       ["#f97316", "#e11d48"],
        instrumental: ["#06b6d4", "#2563eb"],
        lofi:       ["#8b5cf6", "#fbc8d5"],
        ambient:    ["#14b8a6", "#3b82f6"],
        acoustic:   ["#fbbf24", "#fb923c"],
        blues:      ["#3b82f6", "#1e40af"],
        country:    ["#a16207", "#f59e0b"],
        metal:      ["#334155", "#0f172a"],
        default:    ["#ec4141", "#ff7e5f"],
    };

    // 兜底配色池（未标注曲风时按标题哈希取）
    const fallbacks = Object.keys(palettes).filter((k) => k !== "default").map((k) => palettes[k]);

    function hash(s) {
        let h = 0;
        const str = String(s || "");
        for (let i = 0; i < str.length; i++) {
            h = (h * 31 + str.charCodeAt(i)) >>> 0;
        }
        return h;
    }

    function paletteOf(song) {
        const key = (song && song.genre) || (song && song.tags && song.tags[0]) || "";
        const p = palettes[key];
        if (p) return p;
        const pool = palettes[(song && song.genre) || ""];
        if (pool) return pool;
        return fallbacks[hash((song && song.title) || "") % fallbacks.length];
    }

    /* 返回 { --c1, --c2, --seed } */
    function styleVars(song) {
        const [c1, c2] = paletteOf(song);
        return {
            "--c1": c1,
            "--c2": c2,
            "--seed": hash((song && song.title) || "") % 360,
        };
    }

    /* 生成封面 HTML。cls 为现有 class（如 song-cover / rec-cover），可叠加自定义 */
    function html(song, cls) {
        const vars = styleVars(song);
        const v = Object.entries(vars).map(([k, val]) => `${k}:${val}`).join(";");
        return `<span class="gen-cover ${cls || ""}" style="${v}" aria-hidden="true"><span class="gc-deco"></span><span class="gc-note">♫</span></span>`;
    }

    /* 直接输出内联 style 字符串，用于已有元素 */
    function inlineStyle(song) {
        const v = styleVars(song);
        return Object.entries(v).map(([k, val]) => `${k}:${val}`).join(";");
    }

    return { html, styleVars, inlineStyle, paletteOf };
})();
