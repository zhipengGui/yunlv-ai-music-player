/* ========== 云律 AI 系统媒体控制（Media Session API） ==========
 * 让系统媒体键 / 锁屏 / 耳机线控控制播放器
 * 依赖 window.player（player.js 先加载）
 */
(function () {
    "use strict";
    if (!("mediaSession" in navigator) || !window.player) return;
    const ms = navigator.mediaSession;

    // 生成封面 artwork（优先原图，缺失时用 CoverGen 生成渐变 SVG data URL）
    function artworkOf(song) {
        const out = [];
        if (song && song.cover) {
            try {
                const u = new URL(song.cover, window.location.origin);
                if (u.protocol === "http:" || u.protocol === "https:") {
                    out.push({ src: u.href, sizes: "512x512" });
                }
            } catch (e) { /* ignore */ }
        }
        if (!out.length && song && window.CoverGen) {
            try {
                const p = CoverGen.paletteOf(song) || ["#ec4141", "#ff7e5f"];
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/><text x="256" y="305" font-size="170" text-anchor="middle" fill="rgba(255,255,255,.92)">&#9835;</text></svg>`;
                out.push({ src: "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg))), sizes: "512x512" });
            } catch (e) { /* ignore */ }
        }
        return out;
    }

    window.addEventListener("songchange", (e) => {
        const song = e.detail && e.detail.song;
        if (!song) return;
        try {
            ms.metadata = new MediaMetadata({
                title: song.title || "未知歌曲",
                artist: song.artist || "云律播放器",
                album: song.album || "",
                artwork: artworkOf(song),
            });
        } catch (err) { /* ignore */ }
    });

    window.player.audio.addEventListener("play", () => { ms.playbackState = "playing"; });
    window.player.audio.addEventListener("pause", () => { ms.playbackState = "paused"; });

    ms.setActionHandler("play", () => window.player.togglePlay());
    ms.setActionHandler("pause", () => window.player.togglePlay());
    ms.setActionHandler("previoustrack", () => window.player.prev());
    ms.setActionHandler("nexttrack", () => window.player.next());
    ms.setActionHandler("seekbackward", () => {
        if (window.player.audio) {
            window.player.audio.currentTime = Math.max(0, window.player.audio.currentTime - 10);
        }
    });
    ms.setActionHandler("seekforward", () => {
        if (window.player.audio) {
            window.player.audio.currentTime = Math.min(window.player.audio.duration || 0, window.player.audio.currentTime + 10);
        }
    });
})();
