/* ========== 云律 AI 播放器核心 ==========
 * 职责：队列管理、播放控制、进度/音量、播放模式、播放上报
 * 其他板块通过 window.player 访问
 */
class Player {
    constructor() {
        this.audio = new Audio();
        // 云端直链为跨域资源：声明匿名跨域后，配合云端 CORS 配置，
        // 频谱/EQ 等 Web Audio 处理才不会被浏览器强制静音
        this.audio.crossOrigin = "anonymous";
        this.queue = [];          // 播放队列
        this.currentIndex = -1;
        this.mode = "order";      // order 顺序 / repeat 单曲循环 / shuffle 随机
        this.volume = 0.8;
        this._seekDragging = false;
        this._restored = false;   // 当前队列是否来自上次播放记忆
        this._pendingSeek = null; // 恢复播放的续播点（首次播放时 seek）
        this._lastSave = 0;

        this.audio.volume = this.volume;
        this._bindAudioEvents();
        this._bindDOM();
        this._restoreState();     // 恢复音量/模式/上次播放队列与进度
        // 页面卸载前保存最新进度
        window.addEventListener("pagehide", () => this._saveProgress());
    }

    /* ---------- 队列 ---------- */
    loadQueue(songs) {
        this.queue = songs || [];
        if (this.queue.length && this.currentIndex >= this.queue.length) {
            this.currentIndex = this.queue.length - 1;
        }
        if (this.queue.length && this.currentIndex < 0) {
            this.currentIndex = 0;
        }
        if (!this.queue.length) {
            this.currentIndex = -1;
        }
        // 显式加载新列表 = 用户切换了播放上下文，上次恢复的续播点作废
        this._restored = false;
        this._pendingSeek = null;
    }

    playAtIndex(i) {
        if (i < 0 || i >= this.queue.length) return;
        this.currentIndex = i;
        const song = this.queue[i];
        const url = song.stream_url || API.streamUrl(song.id);
        this.audio.src = url;
        this.audio.play().catch(() => this._handlePlaybackError());
        this._updateNowPlaying(song);
        this._highlightRow(i);
        // 通知其他模块（歌词/海报等）歌曲已切换
        window.dispatchEvent(new CustomEvent("songchange", { detail: { song, index: i } }));
        this._saveState();
    }

    /* 播放失败兜底：在线源自动跳过并提示，避免无声卡住 */
    _handlePlaybackError() {
        const song = this.queue[this.currentIndex];
        if (!song || this._lastErrorSong === song) return;
        this._lastErrorSong = song;
        if (song.stream_url) {
            this._toast(`「${song.title}」无法播放，已自动跳过`);
            this.next();
        } else {
            this._toast(`「${song.title}」播放失败`);
        }
    }

    _toast(msg) {
        let t = document.getElementById("player-toast");
        if (!t) {
            t = document.createElement("div");
            t.id = "player-toast";
            t.style.cssText = "position:fixed;left:50%;bottom:92px;transform:translateX(-50%);background:rgba(20,20,28,.92);color:#fff;padding:9px 18px;border-radius:999px;font-size:13px;z-index:9999;max-width:78%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 20px rgba(0,0,0,.35);pointer-events:none;transition:opacity .3s;";
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = "1";
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 2600);
    }

    togglePlay() {
        if (!this.queue.length) return;
        if (this.audio.paused) {
            if (!this.audio.src) this.playAtIndex(this.currentIndex >= 0 ? this.currentIndex : 0);
            this.audio.play().catch(() => {});
        } else {
            this.audio.pause();
        }
    }

    next() {
        if (!this.queue.length) return;
        if (this.mode === "shuffle") {
            let i;
            do { i = Math.floor(Math.random() * this.queue.length); } while (i === this.currentIndex && this.queue.length > 1);
            this.playAtIndex(i);
        } else {
            this.playAtIndex((this.currentIndex + 1) % this.queue.length);
        }
    }

    prev() {
        if (!this.queue.length) return;
        this.playAtIndex((this.currentIndex - 1 + this.queue.length) % this.queue.length);
    }

    toggleMode() {
        const modes = ["order", "repeat", "shuffle"];
        this.setMode(modes[(modes.indexOf(this.mode) + 1) % modes.length]);
    }

    /* 直接切换到指定模式（order / repeat / shuffle），供设置面板调用 */
    setMode(m) {
        if (["order", "repeat", "shuffle"].indexOf(m) < 0) return;
        this.mode = m;
        this._syncModeUI();
        this._saveState();
    }

    _syncModeUI() {
        const labels = { order: "顺序播放", repeat: "单曲循环", shuffle: "随机播放" };
        const icons = { order: "repeat", repeat: "repeatOne", shuffle: "shuffle" };
        if (!this._el || !this._el.modeBtn) return;
        this._el.modeBtn.innerHTML = ic(icons[this.mode], 17);
        this._el.modeBtn.title = labels[this.mode];
        this._el.modeBtn.classList.toggle("active", this.mode !== "order");
    }

    /* ---------- 内部 ---------- */
    _bindAudioEvents() {
        const a = this.audio;
        a.addEventListener("timeupdate", () => {
            if (this._seekDragging) return;
            const pct = a.duration ? (a.currentTime / a.duration) * 1000 : 0;
            this._el.progress.value = pct;
            this._el.timeCur.textContent = this._fmt(a.currentTime);
            // 播放进度节流保存（每 5 秒）
            const now = Date.now();
            if (now - this._lastSave > 5000) {
                this._lastSave = now;
                this._saveProgress();
            }
        });
        a.addEventListener("loadedmetadata", () => {
            this._el.timeTotal.textContent = this._fmt(a.duration || 0);
            // 恢复到上次播放进度
            if (this._pendingSeek !== null && isFinite(a.duration)) {
                a.currentTime = Math.min(this._pendingSeek, a.duration);
                this._pendingSeek = null;
            }
        });
        a.addEventListener("ended", () => {
            this._report();
            // 定时关闭「播完当前曲」模式：拦截自动切歌
            if (window.__stopAfterEnd && window.__stopAfterEnd()) return;
            if (this.mode === "repeat") {
                this.playAtIndex(this.currentIndex);
            } else {
                this.next();
            }
        });
        a.addEventListener("play", () => { this._el.playBtn.classList.add("playing"); });
        a.addEventListener("pause", () => {
            this._el.playBtn.classList.remove("playing");
            this._saveProgress();
        });
        a.addEventListener("error", () => {
            this._el.playBtn.classList.remove("playing");
            this._handlePlaybackError();
        });
    }

    _bindDOM() {
        this._el = {
            playBtn: document.getElementById("btn-play"),
            prevBtn: document.getElementById("btn-prev"),
            nextBtn: document.getElementById("btn-next"),
            modeBtn: document.getElementById("btn-mode"),
            progress: document.getElementById("progress"),
            volume: document.getElementById("volume"),
            timeCur: document.getElementById("time-cur"),
            timeTotal: document.getElementById("time-total"),
            nowCover: document.getElementById("now-cover"),
            nowTitle: document.getElementById("now-title"),
            nowArtist: document.getElementById("now-artist"),
        };

        // SVG 按钮图标
        this._el.playBtn.innerHTML = icPlayPause(20);
        this._el.prevBtn.innerHTML = ic("prev", 18);
        this._el.nextBtn.innerHTML = ic("next", 18);
        this._el.modeBtn.innerHTML = ic("repeat", 17);
        this._el.modeBtn.title = "顺序播放";
        const lyricBtn = document.getElementById("btn-lyric");
        if (lyricBtn) lyricBtn.innerHTML = ic("lyrics", 17);

        this._el.playBtn.addEventListener("click", () => this.togglePlay());
        this._el.prevBtn.addEventListener("click", () => this.prev());
        this._el.nextBtn.addEventListener("click", () => this.next());
        this._el.modeBtn.addEventListener("click", () => this.toggleMode());

        // 进度条拖拽（避免拖动时被 timeupdate 覆盖）
        const pr = this._el.progress;
        pr.addEventListener("input", () => {
            this._seekDragging = true;
            this._el.timeCur.textContent = this._fmt((pr.value / 1000) * (this.audio.duration || 0));
        });
        pr.addEventListener("change", () => {
            const t = (pr.value / 1000) * (this.audio.duration || 0);
            this.audio.currentTime = t;
            this._seekDragging = false;
        });

        // 音量
        const vol = this._el.volume;
        vol.addEventListener("input", () => {
            this.volume = vol.value / 100;
            this.audio.volume = this.volume;
            clearTimeout(this._volTimer);
            this._volTimer = setTimeout(() => this._saveState(), 400);
        });
    }

    _updateNowPlaying(song) {
        this._el.nowTitle.textContent = song.title || "未知标题";
        this._el.nowArtist.textContent = song.artist || "";
        const cover = this._el.nowCover;
        if (song.cover) {
            cover.innerHTML = `<img src="${song.cover}" alt="cover">`;
        } else {
            cover.innerHTML = CoverGen.html(song);
            cover.querySelectorAll(".gc-note, .gc-deco").forEach((el) => el.remove());
        }
        cover.classList.add("rotating");
    }

    _highlightRow(i) {
        // 表格行（歌单详情）
        document.querySelectorAll(".song-row").forEach((row, idx) => {
            row.classList.toggle("playing", idx === i && this.queue === window._currentQueue);
        });
        // 封面墙卡片
        document.querySelectorAll(".song-card").forEach((card, idx) => {
            card.classList.toggle("playing", idx === i && this.queue === window._currentQueue);
        });
    }

    _fmt(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
    }

    _report() {
        // 播放结束上报（推荐的原料），在线歌曲不记录
        const song = this.queue[this.currentIndex];
        if (song && song.id) {
            const dur = this.audio.duration || 0;
            API.recordPlay(song.id, dur).catch(() => {});
        }
    }

    get currentSong() {
        return this.queue[this.currentIndex] || null;
    }

    /* ---------- 播放状态持久化（刷新后续播） ---------- */
    _restoreState() {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(Player.PERSIST_KEY) || "null"); } catch (e) { s = null; }
        if (s && typeof s === "object") {
            // 音量
            if (typeof s.volume === "number") {
                this.volume = Math.min(1, Math.max(0, s.volume));
                this.audio.volume = this.volume;
                if (this._el.volume) this._el.volume.value = Math.round(this.volume * 100);
            }
            // 播放模式
            if (["order", "repeat", "shuffle"].indexOf(s.mode) >= 0) {
                this.mode = s.mode;
            }
            this._syncModeUI();
            // 播放队列 + 当前歌曲
            if (Array.isArray(s.queue) && s.queue.length &&
                Number.isInteger(s.currentIndex) && s.currentIndex >= 0 && s.currentIndex < s.queue.length) {
                this.queue = s.queue.slice(0, Player.MAX_QUEUE);
                this.currentIndex = s.currentIndex;
                const t = Number(s.currentTime);
                this._pendingSeek = (isFinite(t) && t > 0) ? t : null;
                this._restored = true;
                const song = this.queue[this.currentIndex];
                if (song) {
                    this._updateNowPlaying(song);
                    this._toast("已恢复上次播放，点击 ▶ 继续");
                }
            }
        } else {
            this._syncModeUI();
        }
    }

    _songSnapshot(x) {
        if (!x) return null;
        const o = {
            id: x.id, title: x.title, artist: x.artist, album: x.album,
            genre: x.genre, tags: x.tags, duration: x.duration,
            source: x.source, source_id: x.source_id, cover: x.cover,
        };
        if (x.stream_url) o.stream_url = x.stream_url;
        return o;
    }

    _saveState() {
        try {
            localStorage.setItem(Player.PERSIST_KEY, JSON.stringify({
                queue: this.queue.slice(0, Player.MAX_QUEUE).map((x) => this._songSnapshot(x)),
                currentIndex: this.currentIndex,
                currentTime: this.audio.currentTime || 0,
                mode: this.mode,
                volume: this.volume,
                savedAt: Date.now(),
            }));
        } catch (e) { /* localStorage 写入失败（如空间满）则静默 */ }
    }

    _saveProgress() {
        try {
            const raw = localStorage.getItem(Player.PERSIST_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            if (s && typeof s === "object") {
                s.currentTime = this.audio.currentTime || 0;
                localStorage.setItem(Player.PERSIST_KEY, JSON.stringify(s));
            }
        } catch (e) { /* ignore */ }
    }
}

Player.PERSIST_KEY = "yunly.playback.v1";
Player.MAX_QUEUE = 300;

window.player = new Player();
