/* ========== 云律 AI API 封装 ========== */
function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : null;
}

const API = {
    base: "",

    async request(method, url, params, body) {
        let u = this.base + url;
        if (params) {
            const qs = new URLSearchParams(params).toString();
            u += (u.includes("?") ? "&" : "?") + qs;
        }
        const opts = { method, headers: {} };
        if (body !== undefined && body !== null) {
            if (body instanceof FormData) {
                opts.body = body;
            } else {
                opts.headers["Content-Type"] = "application/json";
                opts.body = JSON.stringify(body);
            }
        }
        if (method !== "GET") {
            opts.headers["X-CSRFToken"] = getCookie("csrftoken") || "";
        }
        const resp = await fetch(u, opts);
        if (!resp.ok) {
            let msg = "请求失败";
            try {
                const d = await resp.json();
                msg = d.error || d.detail || msg;
            } catch (e) { /* ignore */ }
            throw new Error(msg);
        }
        return resp.json();
    },

    get(url, params) { return this.request("GET", url, params); },
    post(url, body) { return this.request("POST", url, null, body); },

    /* ---- 板块1 音乐核心 ---- */
    listSongs(params) { return this.get("/api/music/songs/", params); },
    search(q, sources) {
        const src = Array.isArray(sources) ? sources.join(",") : (sources || "local,jamendo,soundhelix,online");
        return this.get("/api/music/search/", { q, sources: src });
    },
    streamUrl(id) { return this.base + "/api/music/stream/" + id + "/"; },
    recordPlay(id, duration) { return this.post(`/api/music/songs/${id}/play/`, { duration }); },
    getTags() { return this.get("/api/music/tags/"); },
    hotSongs() { return this.get("/api/music/hot/"); },

    /* ---- 板块8 语音点歌 / 听歌报告 ---- */
    voice(text) { return this.post("/api/music/voice/", { text }); },
    reportSummary() { return this.get("/api/report/summary/"); },
    reportLeaderboard() { return this.get("/api/report/leaderboard/"); },
};
