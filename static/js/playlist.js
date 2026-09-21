/* ========== 板块3 歌单管理 ========== */
let currentPlaylist = null;   // 当前打开的歌单
let currentPlaylistSongs = [];// 当前歌单的歌曲队列

window.loadPlaylists = loadPlaylists;

/* ---------- 歌单列表 ---------- */
async function loadPlaylists() {
    const grid = document.getElementById("playlists-grid");
    const hint = document.getElementById("playlists-hint");
    grid.innerHTML = `<div class="empty-hint">加载中…</div>`;
    try {
        const d = await API.get("/api/playlists/");
        const pls = d.playlists;
        hint.style.display = pls.length ? "none" : "block";
        if (!pls.length) { grid.innerHTML = ""; return; }
        grid.innerHTML = pls.map((p) => `
            <div class="playlist-card" data-id="${p.id}" onclick="openPlaylist(${p.id})">
                <div class="playlist-cover" style="${CoverGen.inlineStyle({ title: p.name })}">
                    ${p.cover ? `<img src="${p.cover}" alt="">` : `<span>♫</span>`}
                </div>
                <div class="playlist-info">
                    <div class="playlist-name">${escapeHtml(p.name)}</div>
                    <div class="muted">${p.song_count} 首歌曲</div>
                </div>
            </div>`).join("");
    } catch (e) {
        grid.innerHTML = `<div class="empty-hint">加载失败：${e.message}</div>`;
    }
}

/* ---------- 新建歌单 ---------- */
document.getElementById("create-playlist-btn").addEventListener("click", () => {
    document.getElementById("create-playlist-modal").style.display = "flex";
});
window.closeCreateModal = () => {
    document.getElementById("create-playlist-modal").style.display = "none";
};
document.getElementById("pl-submit").addEventListener("click", async () => {
    const name = document.getElementById("pl-name").value.trim();
    if (!name) { alert("请输入歌单名称"); return; }
    const fd = new FormData();
    fd.append("name", name);
    fd.append("description", document.getElementById("pl-desc").value.trim());
    const coverFile = document.getElementById("pl-cover").files[0];
    if (coverFile) fd.append("cover", coverFile);
    try {
        await API.post("/api/playlists/create/", fd);
        document.getElementById("pl-name").value = "";
        document.getElementById("pl-desc").value = "";
        document.getElementById("pl-cover").value = "";
        window.closeCreateModal();
        await loadPlaylists();
    } catch (e) {
        alert("创建失败：" + e.message);
    }
});

/* ---------- 歌单详情 ---------- */
async function openPlaylist(id) {
    document.getElementById("playlists-main").style.display = "none";
    document.getElementById("playlist-detail").style.display = "block";
    try {
        const d = await API.get(`/api/playlists/${id}/`);
        currentPlaylist = d;
        currentPlaylistSongs = d.songs;
        document.getElementById("pd-name").textContent = d.name;
        document.getElementById("pd-desc").textContent = d.description || "";
        document.getElementById("pd-meta").textContent = `${d.song_count} 首 · 创建于 ${d.created_at}`;
        document.getElementById("pd-cover").innerHTML = d.cover
            ? `<img src="${d.cover}" alt="">`
            : `<span style="${CoverGen.inlineStyle({ title: d.name })}">♫</span>`;
        document.getElementById("pd-cover").style = CoverGen.inlineStyle({ title: d.name });
        renderPlaylistSongs();
    } catch (e) {
        alert("加载歌单失败：" + e.message);
        backToPlaylists();
    }
}

function backToPlaylists() {
    document.getElementById("playlist-detail").style.display = "none";
    document.getElementById("playlists-main").style.display = "block";
    loadPlaylists();
}
document.getElementById("back-to-playlists").addEventListener("click", backToPlaylists);

function renderPlaylistSongs() {
    const listEl = document.getElementById("pd-songs-list");
    const songs = currentPlaylistSongs;
    if (!songs.length) {
        listEl.innerHTML = `<div class="empty-hint">歌单还是空的，点击右上角「添加歌曲」</div>`;
        return;
    }
    listEl.innerHTML = songs.map((s, i) => `
        <div class="song-row pd-row" draggable="true" data-song-id="${s.id}" data-index="${i}">
            <span class="col-index">${i + 1}</span>
            <span class="col-title"><span class="row-cover" style="${CoverGen.inlineStyle(s)}">${s.cover ? `<img src="${s.cover}" alt="">` : "♫"}</span><span class="title-text">${escapeHtml(s.title)}</span></span>
            <span class="col-artist">${escapeHtml(s.artist || "未知")}</span>
            <span class="col-album">${escapeHtml(s.album || "-")}</span>
            <span class="col-duration">${fmtDuration(s.duration)}</span>
            <span class="col-actions">
                <button class="mini-btn" title="播放" onclick="event.stopPropagation(); playPlaylistSong(${i})">${ic("play", 12)}</button>
                <button class="mini-btn danger" title="移除" onclick="event.stopPropagation(); removePlaylistSong(${s.id})">${ic("x", 12)}</button>
            </span>
        </div>`).join("");

    // 点击播放
    listEl.querySelectorAll(".pd-row").forEach((row) => {
        row.addEventListener("click", () => playPlaylistSong(parseInt(row.dataset.index)));
    });
    bindDragSort(listEl);
}

function playPlaylistSong(i) {
    const songs = currentPlaylistSongs;
    if (i < 0 || i >= songs.length) return;
    const s = songs[i];
    const queued = songs.map((x) => ({ ...x, stream_url: x.id ? API.streamUrl(x.id) : x.stream_url }));
    window.player.loadQueue(queued);
    window._currentQueue = queued;
    window.player.playAtIndex(i);
}

async function removePlaylistSong(songId) {
    if (!confirm("从歌单移除这首歌？")) return;
    try {
        await API.post(`/api/playlists/${currentPlaylist.id}/songs/${songId}/`, {});
        currentPlaylistSongs = currentPlaylistSongs.filter((s) => s.id !== songId);
        renderPlaylistSongs();
    } catch (e) {
        alert("移除失败：" + e.message);
    }
}

/* ---------- 拖拽排序 ---------- */
function bindDragSort(container) {
    let dragId = null;
    container.querySelectorAll(".pd-row").forEach((row) => {
        row.addEventListener("dragstart", (e) => {
            dragId = parseInt(row.dataset.songId);
            row.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });
        row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            container.querySelectorAll(".pd-row").forEach((r) => r.classList.remove("drop-target"));
        });
        row.addEventListener("dragover", (e) => {
            e.preventDefault();
            const target = e.currentTarget;
            target.classList.add("drop-target");
        });
        row.addEventListener("dragleave", (e) => {
            e.currentTarget.classList.remove("drop-target");
        });
        row.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drop-target");
            if (dragId === null) return;
            // 计算新顺序
            const rows = Array.from(container.querySelectorAll(".pd-row"));
            const fromIdx = rows.findIndex((r) => parseInt(r.dataset.songId) === dragId);
            const toIdx = rows.findIndex((r) => r === e.currentTarget);
            if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
            const song = currentPlaylistSongs[fromIdx];
            currentPlaylistSongs.splice(fromIdx, 1);
            currentPlaylistSongs.splice(toIdx, 0, song);
            const order = currentPlaylistSongs.map((s) => s.id);
            renderPlaylistSongs();
            try {
                await API.post(`/api/playlists/${currentPlaylist.id}/reorder/`, { order });
            } catch (err) {
                console.error("排序保存失败", err);
            }
        });
    });
}

/* ---------- 删除歌单 ---------- */
document.getElementById("delete-playlist-btn").addEventListener("click", async () => {
    if (!confirm(`确定删除歌单「${currentPlaylist.name}」？此操作不可恢复`)) return;
    try {
        await API.post(`/api/playlists/${currentPlaylist.id}/delete/`, {});
        backToPlaylists();
    } catch (e) {
        alert("删除失败：" + e.message);
    }
});

/* ---------- 添加歌曲弹窗 ---------- */
document.getElementById("add-song-btn").addEventListener("click", () => {
    document.getElementById("add-song-modal").style.display = "flex";
    document.getElementById("modal-search-results").innerHTML = `<div class="empty-hint">输入关键词搜索（本地 + 在线曲库）</div>`;
});
window.closeAddSongModal = () => {
    document.getElementById("add-song-modal").style.display = "none";
};

document.getElementById("modal-search-input").addEventListener("input", debounce(async (e) => {
    const q = e.target.value.trim();
    const resEl = document.getElementById("modal-search-results");
    if (!q) { resEl.innerHTML = `<div class="empty-hint">输入关键词搜索</div>`; return; }
    resEl.innerHTML = `<div class="empty-hint">搜索中…</div>`;
    try {
        const d = await API.search(q);
        window._modalResults = d.songs;
        if (!d.songs.length) { resEl.innerHTML = `<div class="empty-hint">没有找到相关歌曲</div>`; return; }
        resEl.innerHTML = d.songs.map((s, i) => `
            <div class="modal-result" onclick="addSongToCurrent(${i})">
                <span class="row-cover" style="${CoverGen.inlineStyle(s)}">${s.cover ? `<img src="${s.cover}" alt="">` : "♫"}</span>
                <div class="mr-info">
                    <div>${escapeHtml(s.title)}</div>
                    <div class="muted">${escapeHtml(s.artist || "未知")} · ${s.source === "online" ? "在线" : "本地"}</div>
                </div>
                <span class="mini-btn">${ic("plus", 12)}</span>
            </div>`).join("");
    } catch (err) {
        resEl.innerHTML = `<div class="empty-hint">搜索失败</div>`;
    }
}, 400));

window.addSongToCurrent = async (idx) => {
    const s = (window._modalResults || [])[idx];
    if (!s) return;
    try {
        if (s.id) {
            await API.post(`/api/playlists/${currentPlaylist.id}/songs/`, { song_id: s.id });
        } else {
            await API.post(`/api/playlists/${currentPlaylist.id}/songs/`, { song: s });
        }
        // 刷新详情
        const d = await API.get(`/api/playlists/${currentPlaylist.id}/`);
        currentPlaylistSongs = d.songs;
        renderPlaylistSongs();
        document.getElementById("pd-meta").textContent = `${d.song_count} 首 · 创建于 ${d.created_at}`;
    } catch (e) {
        alert(e.message);
    }
};

/* ---------- 工具 ---------- */
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
