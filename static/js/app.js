/* ========== 云律 AI 应用逻辑 ==========
 * 视图切换、封面墙渲染、搜索、图标注入、推荐 Banner
 */
document.addEventListener("DOMContentLoaded", init);

async function init() {
    window._currentQueue = null;
    window._viewSeq = 0; // 列表/搜索请求序号，防止旧请求覆盖新结果
    initIcons();
    bindNav();
    bindSearch();
    bindMoodBox();
    bindRescan();
    bindBanner();
    loadSources();
    await loadSongs();
}

/* ---------- SVG 图标注入 ---------- */
const NAV_ICONS = { discover: "compass", recommend: "calendar", mood: "smile", playlists: "folder", favorites: "heart", recents: "clock", report: "chart" };

function initIcons() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
        const name = NAV_ICONS[btn.dataset.view];
        const slot = btn.querySelector(".nav-ic");
        if (name && slot) slot.innerHTML = ic(name, 17);
    });
    const setEl = (id, name, size) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = ic(name, size || 17);
    };
    const setSel = (sel, name, size) => {
        const el = document.querySelector(sel);
        if (el) el.innerHTML = ic(name, size || 16);
    };
    setEl("search-icon", "search", 16);
    setEl("mood-icon", "smile", 16);
    setEl("vol-icon", "volume", 16);
    setSel(".mood-btn-ic", "sparkles", 14);
    setSel(".banner-tag-ic", "sparkles", 13);

    const rescan = document.getElementById("btn-rescan");
    if (rescan) rescan.innerHTML = `${ic("refresh", 13)} 重新扫描曲库`;
    const createPl = document.getElementById("create-playlist-btn");
    if (createPl) createPl.innerHTML = `${ic("plus", 15)} 新建歌单`;
    const addSong = document.getElementById("add-song-btn");
    if (addSong) addSong.innerHTML = `${ic("plus", 14)} 添加歌曲`;
    const delPl = document.getElementById("delete-playlist-btn");
    if (delPl) delPl.innerHTML = `${ic("trash", 13)} 删除歌单`;
    const refreshReport = document.getElementById("btn-refresh-report");
    if (refreshReport) refreshReport.innerHTML = `${ic("refresh", 13)} 刷新`;
    const backBtn = document.getElementById("back-to-playlists");
    if (backBtn) backBtn.innerHTML = `${ic("arrowLeft", 14)} 返回歌单`;
    const bannerPlay = document.getElementById("banner-play");
    if (bannerPlay) bannerPlay.innerHTML = `${ic("play", 15)} 播放全部`;

    const tabs = document.querySelectorAll(".report-tab");
    if (tabs[0]) tabs[0].innerHTML = `${ic("chart", 14)} 我的听歌报告`;
    if (tabs[1]) tabs[1].innerHTML = `${ic("flame", 14)} 点歌排行榜`;

    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.querySelector(".nav-ic").innerHTML = ic("shirt", 17);
    const dashBtn = document.getElementById("dash-btn");
    if (dashBtn) dashBtn.querySelector(".nav-ic").innerHTML = ic("trend", 17);
}

/* ---------- 视图切换 ---------- */
function bindNav() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
        if (!btn.dataset.view) return; // 换肤按钮等无 data-view 的导航项不参与视图切换
        btn.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const view = btn.dataset.view;
            document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
            const target = document.getElementById("view-" + view);
            if (target) target.classList.add("active");
            // 各板块视图懒加载
            if (view === "discover") loadSongs();
            if (view === "recommend") window.loadRecommend && window.loadRecommend();
            if (view === "mood") window.loadMoodView && window.loadMoodView();
            if (view === "playlists") window.loadPlaylists && window.loadPlaylists();
            if (view === "favorites") window.loadFavoritesView && window.loadFavoritesView();
            if (view === "recents") window.loadRecentsView && window.loadRecentsView();
            if (view === "report") window.loadReport && window.loadReport();
            if (view === "dashboard") loadDashboardView();
        });
    });
}

/* 数据大屏视图：首次进入才加载 iframe，之后切走/切回保留状态（不重新加载） */
function loadDashboardView() {
    const frame = document.getElementById("dash-frame");
    if (frame && !frame.getAttribute("src")) frame.src = "/dashboard/";
}

/* ---------- 音乐源 ---------- */
async function loadSources() {
    try {
        const d = await API.getTags();
        const el = document.getElementById("sources-list");
        el.innerHTML = d.sources.map((s) => `<span>${s.label}</span>`).join("");
        // 缓存情绪标签 / 曲风的中文映射，供标签角标、情绪点歌台等渲染使用
        // 词表单一数据源在后端，这里只做展示层翻译，查不到的原样显示
        window.MoodTagLabels = Object.fromEntries((d.tags || []).map((t) => [t.name, t.label]));
        window.GenreLabels = Object.fromEntries((d.genres || []).map((g) => [g.name, g.label]));
    } catch (e) { /* ignore */ }
}

/* ---------- 标签中文翻译（展示层） ---------- */
function tagLabel(t) {
    return (window.MoodTagLabels && window.MoodTagLabels[t]) || t;
}
function tagLabels(tags) {
    return (tags || []).map(tagLabel);
}
function genreLabel(g) {
    return (window.GenreLabels && window.GenreLabels[g]) || g;
}

/* ---------- 歌曲列表 ---------- */
async function loadSongs(params) {
    const seq = ++window._viewSeq;
    const listEl = document.getElementById("song-list");
    const countEl = document.getElementById("song-count");
    const hintEl = document.getElementById("search-hint");
    if (hintEl) hintEl.style.display = "none";
    listEl.innerHTML = `<div class="empty-hint">加载中…</div>`;
    try {
        const d = await API.listSongs(params || {});
        if (seq !== window._viewSeq) return; // 已有更新的请求，丢弃本次结果

        const songs = d.songs;
        document.getElementById("empty-hint").style.display = songs.length ? "none" : "block";
        countEl.textContent = `${songs.length} 首`;
        renderSongList(listEl, songs);
        window._currentQueue = songs;
        // 若处于"恢复上次播放"状态，则不覆盖播放队列（播放条仍继续上次的歌）
        if (!window.player._restored) {
            window.player.loadQueue(songs);
        }
        fillBanner(songs);
    } catch (e) {
        listEl.innerHTML = `<div class="empty-hint">加载失败：${e.message}</div>`;
    }
}

/* 渲染封面墙（本地歌曲用数据库id，在线歌曲用 stream_url）
 * 分片渲染：长列表只渲染前 50 条，滚动到底自动加载下一批，
 * 队列仍保持全量，索引映射不变。 */
const LIST_PAGE = 50;

function renderSongList(container, songs, startIndex) {
    if (!songs.length) {
        container.innerHTML = `<div class="empty-hint">没有找到歌曲</div>`;
        return;
    }
    container._songs = songs; // 页面队列挂到容器上，供 playRow 切换播放上下文
    container._startIndex = startIndex || 0;
    container._renderCount = 0;
    if (!container.classList.contains("song-grid")) container.classList.add("song-grid");
    container.innerHTML = "";
    _renderSongChunk(container);
}

function _renderSongChunk(container) {
    const songs = container._songs;
    const startIndex = container._startIndex || 0;
    const from = container._renderCount;
    const to = Math.min(from + LIST_PAGE, songs.length);
    if (to <= from) return;

    const html = songs.slice(from, to).map((s, i) => {
        const idx = startIndex + from + i;
        const cover = s.cover
            ? `<span class="gen-cover"><img src="${s.cover}" alt=""></span>`
            : CoverGen.html(s, "sc-cover");
        const srcChip = (() => {
            const map = {
                local: ["local", "本地"],
                jamendo: ["jamendo", "完整版"],
                soundhelix: ["soundhelix", "纯音乐"],
                online: ["online", "试听"],
            };
            const [cls, txt] = map[s.source] || [];
            return cls ? `<span class="source-chip ${cls}">${txt}</span>` : "";
        })();
        const tags = tagLabels(s.tags).slice(0, 2).map((t) => `<span class="tag-chip">${t}</span>`).join("");
        const genre = s.genre ? `<span class="genre-chip">${genreLabel(s.genre)}</span>` : "";
        const favCls = window.FavStore && FavStore.isFavorite(s) ? " active" : "";
        return `
        <div class="song-card" data-index="${idx}" data-id="${s.id || ""}" data-stream="${s.stream_url || ""}" data-title="${escapeHtml(s.title)}" data-artist="${escapeHtml(s.artist || "未知")}">
            <span class="sc-cover-wrap">${cover}
                <button class="sc-play" title="播放">${ic("play", 14)}</button>
                <button class="fav-btn${favCls}" data-idx="${idx}" title="收藏">${ic("heart", 14)}</button>
            </span>
            <div class="sc-info">
                <div class="sc-title">${escapeHtml(s.title)}${srcChip}</div>
                <div class="sc-artist">${escapeHtml(s.artist || "未知")}</div>
                <div class="sc-badges">${tags}${genre}</div>
            </div>
        </div>`;
    }).join("");

    container.insertAdjacentHTML("beforeend", html);
    container._renderCount = to;

    // 绑定交互（只绑定本批新增的卡片）
    const cards = container.querySelectorAll(".song-card");
    for (let i = from; i < to; i++) {
        const row = cards[i];
        if (!row || row.dataset.bound) continue;
        row.dataset.bound = "1";
        const playBtn = row.querySelector(".sc-play");
        if (playBtn) playBtn.addEventListener("click", (e) => { e.stopPropagation(); playRow(row); });
        const favBtn = row.querySelector(".fav-btn");
        if (favBtn) favBtn.addEventListener("click", (e) => { e.stopPropagation(); _toggleFavorite(container, row); });
        row.addEventListener("click", () => playRow(row));
        // 右键：弹出 播放/收藏/加入歌单 菜单
        row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            const idx = parseInt(row.dataset.index, 10);
            const song = (container._songs || [])[idx] || null;
            if (song && window.openContextMenu) window.openContextMenu(e, row, song);
        });
    }

    // 还有更多：挂哨兵，进入视口时加载下一批
    if (to < songs.length) {
        const sentinel = document.createElement("div");
        sentinel.className = "list-sentinel";
        sentinel.style.height = "1px";
        container.appendChild(sentinel);
        const obs = _listObserver();
        if (obs) obs.observe(sentinel);
    }
}

function _toggleFavorite(container, row) {
    const idx = parseInt(row.dataset.index);
    const song = container._songs && container._songs[idx];
    if (!song || !window.FavStore) return;
    FavStore.toggle(song);
    const favBtn = row.querySelector(".fav-btn");
    if (favBtn) favBtn.classList.toggle("active", FavStore.isFavorite(song));
    // 在「我的收藏」视图里取消收藏时，同步移除卡片
    const favView = document.getElementById("view-favorites");
    if (favView && favView.classList.contains("active") && window.loadFavoritesView) {
        window.loadFavoritesView();
    }
}

let _listObserverInstance = null;
function _listObserver() {
    if (!("IntersectionObserver" in window)) return null;
    if (_listObserverInstance) return _listObserverInstance;
    _listObserverInstance = new IntersectionObserver((entries) => {
        for (const en of entries) {
            if (!en.isIntersecting) continue;
            const sentinel = en.target;
            const container = sentinel.parentElement;
            if (!container) continue;
            _listObserverInstance.unobserve(sentinel);
            sentinel.remove();
            _renderSongChunk(container);
        }
    }, { rootMargin: "240px 0px" });
    return _listObserverInstance;
}

function playRow(row) {
    const idx = parseInt(row.dataset.index);
    // 点击列表 = 显式切换播放上下文到当前页面列表
    const container = row.closest("#song-list") || row.parentElement;
    const listSongs = (container && container._songs) || window._currentQueue;
    if (window.player.queue !== listSongs) {
        window.player.loadQueue(listSongs);
    }
    window._currentQueue = listSongs;
    const song = listSongs && listSongs[idx];
    if (song) {
        window.player.playAtIndex(idx);
    } else if (row.dataset.stream) {
        // 在线歌曲未入队列的场景
        const s = { title: row.dataset.title, artist: row.dataset.artist, stream_url: row.dataset.stream };
        window.player.queue = [s];
        window._currentQueue = [s];
        window.player.playAtIndex(0);
    }
}

/* ---------- 推荐 Banner ---------- */
function bindBanner() {
    const playBtn = document.getElementById("banner-play");
    const shuffleBtn = document.getElementById("banner-shuffle");
    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (window._currentQueue && window._currentQueue.length) window.player.playAtIndex(0);
        });
    }
    if (shuffleBtn) {
        shuffleBtn.addEventListener("click", () => {
            if (!window._currentQueue || !window._currentQueue.length) return;
            const i = Math.floor(Math.random() * window._currentQueue.length);
            window.player.playAtIndex(i);
        });
    }
}

function fillBanner(songs) {
    const banner = document.getElementById("banner");
    if (!banner || !songs || !songs.length) return;
    const pick = songs[Math.floor(Math.random() * Math.min(songs.length, 10))];
    const genre = pick.genre || (pick.tags && pick.tags[0]) || "华语";
    document.getElementById("banner-title").textContent = `「${pick.title}」`;
    document.getElementById("banner-sub").textContent = `${pick.artist || "未知歌手"} · ${genreLabel(genre)}`;
    const vars = CoverGen.styleVars(pick);
    Object.entries(vars).forEach(([k, v]) => banner.style.setProperty(k, v));
    banner.style.display = "block";
}

/* ---------- 搜索 ---------- */
function bindSearch() {
    const input = document.getElementById("search-input");
    let timer = null;
    input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const q = input.value.trim();
            document.getElementById("discover-title").textContent = q ? `搜索：${q}` : "发现音乐";
            if (!q) { await loadSongs(); return; }
            const seq = ++window._viewSeq;
            const listEl = document.getElementById("song-list");
            const hintEl = document.getElementById("search-hint");
            if (hintEl) hintEl.style.display = "none";
            listEl.innerHTML = `<div class="empty-hint">搜索中…</div>`;
            try {
                const d = await API.search(q);
                if (seq !== window._viewSeq) return; // 丢弃过期请求结果
                // 在线结果提示：iTunes 源仅 30 秒试听（Jamendo/SoundHelix 为完整版）
                if (hintEl) {
                    if (d.songs.some((s) => s.source === "online")) {
                        hintEl.textContent = /[\u4e00-\u9fa5]/.test(q)
                            ? "⚠ 带「试听」的是 30 秒片段（iTunes）；「完整版」来自 Jamendo 欧美曲库，中文歌曲基本没有，可试试英文关键词（如 piano、jazz、rock）。"
                            : "⚠ 带「试听」的是 30 秒片段（iTunes），带「完整版」的是 Jamendo 授权音乐可整曲播放。";
                        hintEl.style.display = "block";
                    } else {
                        hintEl.style.display = "none";
                    }
                }
                const songs = d.songs.map((s) => ({
                    id: s.id, title: s.title, artist: s.artist, album: s.album,
                    genre: s.genre, tags: s.tags, duration: s.duration,
                    cover: s.cover, stream_url: s.stream_url, source: s.source,
                }));
                document.getElementById("song-count").textContent = `${songs.length} 条结果`;
                renderSongList(listEl, songs);
                window.player.loadQueue(songs);
                window._currentQueue = songs;
            } catch (e) {
                listEl.innerHTML = `<div class="empty-hint">搜索失败：${e.message}</div>`;
            }
        }, 400);
    });
}

/* ---------- 重新扫描曲库（新增歌曲自动 AI 打标） ---------- */
let _tagPollTimer = null;

function setTaggingStatus(txt) {
    const el = document.getElementById("tagging-status");
    if (el) el.textContent = txt || "";
}

function pollTagging() {
    clearInterval(_tagPollTimer);
    _tagPollTimer = setInterval(async () => {
        let d = null;
        try {
            d = await API.get("/api/music/tag_progress/");
        } catch (e) {
            clearInterval(_tagPollTimer);
            setTaggingStatus("");
            return;
        }
        if (!d.running) {
            clearInterval(_tagPollTimer);
            setTaggingStatus("");
            loadSongs();  // 打标完成，刷新列表展示新标签
            if (d.total > 0 && d.changed > 0) {
                alert(`新歌打标完成：共 ${d.total} 首，${d.changed} 首已更新情绪标签`);
            }
            return;
        }
        setTaggingStatus(`新歌情绪标签生成中… ${d.done}/${d.total}`);
    }, 3000);
}

function bindRescan() {
    const btn = document.getElementById("btn-rescan");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "扫描中…";
        try {
            const d = await API.post("/api/music/scan/", {});
            let msg = `扫描完成：新增 ${d.added} 首，曲库共 ${d.total} 首`;
            if (d.tagging) {
                msg += "\n情绪标签正在后台自动生成，完成后自动刷新（约 1-2 秒/首）";
                alert(msg);
                loadSongs();
                pollTagging();
            } else {
                if (d.added > 0) msg += "\n（上一次打标尚未完成，新歌将排队处理）";
                alert(msg);
                loadSongs();
            }
        } catch (e) {
            alert("扫描失败：" + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `${ic("refresh", 13)} 重新扫描曲库`;
        }
    });
}

/* ---------- 情绪输入框 ---------- */
function bindMoodBox() {
    const input = document.getElementById("mood-input");
    const btn = document.getElementById("mood-btn");
    const submit = () => {
        const text = input.value.trim();
        if (!text) return;
        if (window.submitMood) {
            window.submitMood(text);
        } else {
            alert("情绪点歌台（板块6）尚未开发");
        }
    };
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

/* ---------- 工具函数 ---------- */
function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function fmtDuration(sec) {
    if (!sec) return "-";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}
