/* ========== 云律 AI 键盘快捷键 ==========
 * 桌面端全局快捷键：播放控制 + 快捷操作
 * 输入框/编辑区聚焦时自动停用（Esc 例外，用于取消聚焦），避免干扰打字
 * 全部复用现有模块能力：window.player / window.FavStore / window.submitMood
 * 帮助面板：? 或 Shift+/ 打开，Esc 关闭
 */
(function () {
    "use strict";

    // 数字键 1~7 对应的侧边栏板块
    const VIEW_KEYS = {
        "1": "discover", "2": "recommend", "3": "mood", "4": "playlists",
        "5": "favorites", "6": "recents", "7": "report",
    };

    const player = () => window.player;
    let mutedBefore = null; // 静音前音量，用于取消静音恢复

    function isEditable(el) {
        if (!el) return false;
        const t = el.tagName;
        return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
    }

    function toast(msg) {
        const p = player();
        if (p && p._toast) p._toast(msg);
    }

    function currentSong() {
        const p = player();
        if (!p || !p.queue || p.currentIndex < 0) return null;
        return p.queue[p.currentIndex] || null;
    }

    function setVolume(v) {
        const p = player();
        if (!p || !p.audio) return;
        v = Math.max(0, Math.min(1, v));
        p.volume = v;
        p.audio.volume = v;
        // 调音量时自动解除静音
        if (p.audio.muted) { p.audio.muted = false; mutedBefore = null; }
        const slider = document.getElementById("volume");
        if (slider) slider.value = Math.round(v * 100);
    }

    function toggleMute() {
        const p = player();
        if (!p || !p.audio) return;
        if (p.audio.muted) {
            p.audio.muted = false;
            if (mutedBefore != null) setVolume(mutedBefore);
            toast("已取消静音");
        } else {
            mutedBefore = p.volume;
            p.audio.muted = true;
            toast("已静音");
        }
    }

    function seek(delta) {
        const p = player();
        if (!p || !p.audio || !isFinite(p.audio.duration)) return;
        p.audio.currentTime = Math.max(0, Math.min(p.audio.duration, p.audio.currentTime + delta));
    }

    function switchView(view) {
        const btn = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (btn) btn.click(); // 复用侧边栏点击逻辑（含各板块懒加载）
    }

    function toggleFavorite() {
        const song = currentSong();
        if (!song) { toast("当前没有播放中的歌曲"); return; }
        const now = window.FavStore.toggle(song);
        toast(now ? "已收藏《" + song.title + "》" : "已取消收藏《" + song.title + "》");
    }

    function focusSearch() {
        const el = document.getElementById("search-input");
        if (el) { el.focus(); el.select && el.select(); }
    }
    function focusMood() {
        const el = document.getElementById("mood-input");
        if (el) { el.focus(); el.select && el.select(); }
    }

    /* ---------- 快捷键帮助面板 ---------- */
    const modal = () => document.getElementById("shortcut-modal");
    function openHelp() { const m = modal(); if (m) m.style.display = "flex"; }
    function closeHelp() { const m = modal(); if (m) m.style.display = "none"; }

    function handle(e) {
        // 输入框聚焦：不拦截打字；Esc 取消聚焦
        if (isEditable(e.target)) {
            if (e.key === "Escape") e.target.blur();
            return;
        }

        const key = e.key;
        const mod = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        // 帮助面板已打开：Esc / ? 关闭，其余按键不响应
        const m = modal();
        if (m && m.style.display === "flex") {
            if (key === "Escape" || key === "?" || (shift && key === "/")) {
                closeHelp();
                e.preventDefault();
            }
            return;
        }

        // 组合键：Ctrl/Meta + K 搜索，Ctrl/Meta + L AI 点歌
        if (mod && key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return; }
        if (mod && key.toLowerCase() === "l") { e.preventDefault(); focusMood(); return; }

        // 帮助面板：Shift+/ 或 ?
        if ((shift && key === "/") || key === "?") { e.preventDefault(); openHelp(); return; }

        // 其余带修饰键的组合一律不处理，避免误触
        if (mod || e.altKey) return;

        switch (key) {
            case " ": // 播放 / 暂停（同时阻止按钮默认激活，避免重复触发）
                e.preventDefault();
                player() && player().togglePlay();
                break;
            case "ArrowLeft":  e.preventDefault(); player() && player().prev(); break;
            case "ArrowRight": e.preventDefault(); player() && player().next(); break;
            case "ArrowUp":    e.preventDefault(); setVolume((player() && player().volume || 0) + 0.1); break;
            case "ArrowDown":  e.preventDefault(); setVolume((player() && player().volume || 0) - 0.1); break;
            case "m": case "M": e.preventDefault(); toggleMute(); break;
            case "[": e.preventDefault(); seek(-10); break;
            case "]": e.preventDefault(); seek(10); break;
            case "r": case "R": e.preventDefault(); player() && player().toggleMode(); break;
            case "f": case "F": e.preventDefault(); toggleFavorite(); break;
            case "/": e.preventDefault(); focusSearch(); break;
            case "Escape": closeHelp(); break;
            default:
                if (/^[1-7]$/.test(key)) { e.preventDefault(); switchView(VIEW_KEYS[key]); }
        }
    }

    document.addEventListener("keydown", handle);

    // 帮助面板：关闭按钮 / 点击遮罩关闭
    document.addEventListener("click", (e) => {
        if (e.target && (e.target.id === "shortcut-close" || e.target.id === "shortcut-modal")) {
            closeHelp();
        }
    });

    window.Shortcuts = { openHelp, closeHelp };
})();
