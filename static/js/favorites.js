/* ========== 云律 AI 收藏 / 最近播放 ==========
 * 本地存储（localStorage）：无用户体系下最合适，各存各的互不覆盖
 * - 收藏：yunly.favorites.v1（歌曲快照数组）
 * - 最近播放：yunly.recents.v1（最多 50 条）
 */
(function () {
    "use strict";
    const FAV_KEY = "yunly.favorites.v1";
    const REC_KEY = "yunly.recents.v1";
    const MAX_RECENTS = 50;

    function load(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
    }
    function save(key, arr) {
        try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* ignore */ }
    }

    // 唯一键：本地歌用 id，在线歌用 stream_url
    function keyOf(song) {
        return song ? (song.id ? "id:" + song.id : "url:" + (song.stream_url || "")) : "";
    }

    function snapshot(song) {
        if (!song) return null;
        const o = {
            id: song.id, title: song.title, artist: song.artist, album: song.album,
            genre: song.genre, tags: song.tags, duration: song.duration,
            source: song.source, source_id: song.source_id, cover: song.cover,
        };
        if (song.stream_url) o.stream_url = song.stream_url;
        return o;
    }

    const FavStore = {
        get favorites() { return load(FAV_KEY); },
        isFavorite(song) {
            const k = keyOf(song);
            if (!k) return false;
            return load(FAV_KEY).some((x) => keyOf(x) === k);
        },
        toggle(song) {
            if (!song) return false;
            const k = keyOf(song);
            const arr = load(FAV_KEY);
            const i = arr.findIndex((x) => keyOf(x) === k);
            if (i >= 0) { arr.splice(i, 1); save(FAV_KEY, arr); return false; }
            arr.unshift(snapshot(song)); save(FAV_KEY, arr); return true;
        },
        recents() { return load(REC_KEY); },
        pushRecent(song) {
            if (!song) return;
            const k = keyOf(song);
            const arr = load(REC_KEY).filter((x) => keyOf(x) !== k);
            arr.unshift(snapshot(song));
            if (arr.length > MAX_RECENTS) arr.length = MAX_RECENTS;
            save(REC_KEY, arr);
        },
    };
    window.FavStore = FavStore;

    // 切歌时记录最近播放
    window.addEventListener("songchange", (e) => {
        const song = e.detail && e.detail.song;
        if (song) FavStore.pushRecent(song);
    });

    /* ---------- 视图加载 ---------- */
    window.loadFavoritesView = function () {
        const list = FavStore.favorites;
        const el = document.getElementById("favorites-list");
        if (!el) return;
        renderSongList(el, list);
        const hint = document.getElementById("favorites-hint");
        if (hint) hint.style.display = list.length ? "none" : "block";
        const count = document.getElementById("favorites-count");
        if (count) count.textContent = `${list.length} 首`;
    };

    window.loadRecentsView = function () {
        const list = FavStore.recents();
        const el = document.getElementById("recents-list");
        if (!el) return;
        renderSongList(el, list);
        const hint = document.getElementById("recents-hint");
        if (hint) hint.style.display = list.length ? "none" : "block";
        const count = document.getElementById("recents-count");
        if (count) count.textContent = `${list.length} 首`;
    };
})();
