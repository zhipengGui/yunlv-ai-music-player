/* ========== 云律 AI 右键菜单 ==========
 * 在歌曲卡片上右键弹出：播放 / 收藏 / 加入歌单 / 新建歌单
 * 菜单 DOM 动态创建，歌单数据每次打开时现拉，保证与后端一致
 */
(function () {
    "use strict";
    let menu = null;
    let toast = null;
    let currentRow = null;    // 触发菜单的歌曲卡片
    let currentSong = null;   // 对应的 song 对象

    function ensureMenu() {
        if (menu) return menu;
        menu = document.createElement("div");
        menu.className = "context-menu";
        menu.style.display = "none";
        // 菜单内部点击不冒泡到 document（避免触发全局关闭）
        menu.addEventListener("click", (e) => e.stopPropagation());
        document.body.appendChild(menu);
        return menu;
    }

    function showToast(msg) {
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "ctx-toast";
            toast.className = "ctx-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    function closeMenu() {
        if (!menu) return;
        menu.style.display = "none";
        currentRow = null;
        currentSong = null;
    }

    /* ---------- 歌单数据 ---------- */
    async function loadPlaylists() {
        try {
            const d = await API.get("/api/playlists/");
            return d.playlists || [];
        } catch (e) {
            return [];
        }
    }

    /* ---------- 添加歌曲到歌单（复用后端已有接口） ---------- */
    async function addToPlaylist(plId, song, plName) {
        if (!song) return;
        try {
            const body = song.id ? { song_id: song.id } : { song };
            await API.post(`/api/playlists/${plId}/songs/`, body);
            showToast(`已加入歌单「${plName}」`);
        } catch (e) {
            showToast(e.message || "添加失败");
        }
    }

    /* ---------- 渲染菜单内容 ---------- */
    function buildMenu(song, playlists) {
        const isFav = window.FavStore && FavStore.isFavorite(song);
        const favText = isFav ? "取消收藏" : "收藏";
        const plItems = playlists.length
            ? playlists.map((p) =>
                `<button class="ctx-item" data-pl-id="${p.id}">${ic("folder", 13)} ${escapeHtml(p.name)}</button>`).join("")
            : `<div class="ctx-empty">还没有歌单，先新建一个吧</div>`;
        menu.innerHTML = `
            <div class="ctx-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
            <button class="ctx-item" data-act="play">${ic("play", 13)} 播放</button>
            <button class="ctx-item" data-act="fav">${ic("heart", 13)} ${favText}</button>
            <div class="ctx-sep"></div>
            <div class="ctx-label">加入歌单</div>
            <div class="ctx-pls">${plItems}</div>
            <button class="ctx-item ctx-new" data-act="new">${ic("plus", 13)} 新建歌单</button>
        `;

        // 播放
        menu.querySelector('[data-act="play"]').addEventListener("click", () => {
            const row = currentRow;
            closeMenu();
            if (row && window.playRow) window.playRow(row);
        });
        // 收藏 / 取消收藏
        menu.querySelector('[data-act="fav"]').addEventListener("click", () => {
            const song = currentSong;
            const row = currentRow;
            closeMenu();
            if (!song || !window.FavStore) return;
            const added = FavStore.toggle(song);
            // 同步卡片上的心形按钮状态
            const favBtn = row && row.querySelector(".fav-btn");
            if (favBtn) favBtn.classList.toggle("active", FavStore.isFavorite(song));
            // 在「我的收藏」视图里取消收藏时同步移除卡片
            const favView = document.getElementById("view-favorites");
            if (favView && favView.classList.contains("active") && window.loadFavoritesView) {
                window.loadFavoritesView();
            }
            showToast(added ? "已加入我的收藏" : "已取消收藏");
        });
        // 加入歌单
        menu.querySelectorAll("[data-pl-id]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = parseInt(btn.dataset.plId, 10);
                const pl = playlists.find((p) => p.id === id);
                const song = currentSong;
                closeMenu();
                await addToPlaylist(id, song, pl ? pl.name : "歌单");
            });
        });
        // 新建歌单
        menu.querySelector('[data-act="new"]').addEventListener("click", () => {
            closeMenu();
            const modal = document.getElementById("create-playlist-modal");
            if (modal) modal.style.display = "flex";
        });
    }

    /* ---------- 打开菜单（由 app.js 在卡片 contextmenu 时调用） ---------- */
    window.openContextMenu = async function (e, row, song) {
        e.preventDefault();
        e.stopPropagation();
        if (!song) return;
        currentRow = row;
        currentSong = song;
        const el = ensureMenu();
        const playlists = await loadPlaylists();
        if (currentSong !== song) return; // 期间已切换/关闭
        buildMenu(song, playlists);

        // 定位：贴近鼠标，靠近视口边缘时翻转
        const pad = 8;
        el.style.display = "block";
        const rect = el.getBoundingClientRect();
        let x = e.clientX;
        let y = e.clientY;
        if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
        if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
        el.style.left = `${Math.max(pad, x)}px`;
        el.style.top = `${Math.max(pad, y)}px`;
    };

    /* ---------- 全局关闭 ---------- */
    document.addEventListener("click", closeMenu);
    // 空白区域右键关闭（卡片右键已 stopPropagation，不会走到这里）
    document.addEventListener("contextmenu", closeMenu);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
    });
    window.addEventListener("blur", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
})();
