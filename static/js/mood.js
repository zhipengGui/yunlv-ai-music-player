/* ========== 板块6 AI 情绪点歌台（对话式） ==========
 * - 顶部输入框提交 = 开启新话题（清空历史）
 * - AI 气泡内「继续追问」chips = 多轮对话（带 history + 排除已推荐）
 * - 「换一批」 = 复用上次解析结果（cached_result），零 AI 成本
 */
let moodQueue = [];
let moodHistory = [];      // [{role, content}] 发给后端做多轮上下文
let excludeIds = [];       // 已推荐过的歌曲 id（防重复）
let lastMood = null;       // 上次解析结果 {emotions, tags, genres, description}
let lastText = "";         // 上次问题文本（换一批时携带）

const FOLLOW_CHIPS = ["再放松一点", "换几首", "不要纯音乐", "来点中文的"];
const QUICK_CHIPS = [
    { icon: "😔", text: "有点难过" },
    { icon: "🔥", text: "今天想蹦迪" },
    { icon: "🎹", text: "学习要专注" },
    { icon: "🌙", text: "失眠了" },
    { icon: "💤", text: "累了想放松" },
    { icon: "🎸", text: "想听民谣" },
    { icon: "❤️", text: "想恋爱了" },
    { icon: "😊", text: "心情很好" },
];

window.submitMood = submitMood;
window.loadMoodView = loadMoodView;
window.moodFollow = moodFollow;
window.moodRefresh = moodRefresh;
window.playMoodSong = playMoodSong;

/* ---------- 视图切换 ---------- */
function switchToMoodView() {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelector('.nav-item[data-view="mood"]')?.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById("view-mood").classList.add("active");
}

function scrollMoodBottom() {
    const chat = document.getElementById("mood-chat");
    if (chat) chat.scrollTop = chat.scrollHeight;
}

function loadMoodView() {
    const chat = document.getElementById("mood-chat");
    const hint = document.getElementById("mood-hint");
    if (!chat) return;
    hint.style.display = chat.children.length ? "none" : "block";
}

/* ---------- 发起提问 ---------- */
async function submitMood(text) {
    text = (text || "").trim();
    if (!text) return;
    // 顶部输入 = 全新话题
    moodHistory = [];
    excludeIds = [];
    lastText = text;
    switchToMoodView();
    appendUserMsg(text);
    const loading = appendAiMsg(null, "AI 正在理解你的心情…");
    try {
        const d = await API.post("/api/mood/songs/", { text });
        onMoodResult(d, loading);
    } catch (e) {
        loading.innerHTML = `<div class="mood-bubble">${ic("sparkles", 16)} 出错了：${escapeHtml(e.message)}</div>`;
    }
}

/* ---------- 多轮追问 ---------- */
async function moodFollow(question) {
    lastText = question;
    appendUserMsg(question);
    const loading = appendAiMsg(null, "AI 结合上下文调整中…");
    try {
        const d = await API.post("/api/mood/songs/", {
            text: question,
            history: moodHistory,
            exclude_ids: excludeIds,
        });
        onMoodResult(d, loading);
    } catch (e) {
        loading.innerHTML = `<div class="mood-bubble">${ic("sparkles", 16)} 出错了：${escapeHtml(e.message)}</div>`;
    }
}

/* ---------- 换一批（不调 AI） ---------- */
async function moodRefresh() {
    if (!lastMood) return;
    const loading = appendAiMsg(null, "换个角度，再给你挑一批…");
    try {
        const d = await API.post("/api/mood/songs/", {
            text: lastText,
            cached_result: lastMood,
            exclude_ids: excludeIds,
        });
        onMoodResult(d, loading);
    } catch (e) {
        loading.innerHTML = `<div class="mood-bubble">${ic("sparkles", 16)} 出错了：${escapeHtml(e.message)}</div>`;
    }
}

/* ---------- 结果处理 ---------- */
function onMoodResult(d, el) {
    lastMood = {
        emotions: d.emotions, tags: d.tags, genres: d.genres,
        description: d.description,
    };
    // 追加到播放队列（换一批/追问时叠加，保证每首都可播）
    moodQueue = moodQueue.concat(d.songs.map((s) => ({
        ...s,
        stream_url: s.id ? API.streamUrl(s.id) : s.stream_url,
    })));
    excludeIds.push(...d.songs.map((s) => s.id));
    // 记录对话历史（保留最近 10 条，防 token 膨胀）
    moodHistory.push({ role: "user", content: lastText });
    moodHistory.push({ role: "assistant", content: buildAiSummary(d) });
    if (moodHistory.length > 10) moodHistory = moodHistory.slice(-10);

    el.innerHTML = renderAiBubble(d);
    scrollMoodBottom();
    loadMoodView();
}

function buildAiSummary(d) {
    const t = [...(d.emotions || []), ...(d.tags || [])].map(tagLabel).join("/");
    const g = (d.genres || []).map(genreLabel).join("/");
    return `为你推荐了 ${d.count} 首（情绪：${t || "-"}，曲风：${g || "-"}）。${d.description}`;
}

/* ---------- 气泡渲染 ---------- */
function appendUserMsg(text) {
    const wrap = document.createElement("div");
    wrap.className = "mood-msg mood-user";
    wrap.innerHTML = `<div class="mood-bubble">${escapeHtml(text)}</div>`;
    document.getElementById("mood-chat").appendChild(wrap);
    scrollMoodBottom();
}

function appendAiMsg(d, loadingText) {
    const wrap = document.createElement("div");
    wrap.className = "mood-msg mood-ai";
    if (loadingText) {
        wrap.innerHTML = `<div class="mood-bubble typing">${escapeHtml(loadingText)}</div>`;
    } else {
        wrap.innerHTML = renderAiBubble(d);
    }
    document.getElementById("mood-chat").appendChild(wrap);
    scrollMoodBottom();
    return wrap;
}

function renderAiBubble(d) {
    const songs = d.songs || [];
    return `
        <div class="mood-bubble">
            <div class="mood-desc">${ic("sparkles", 16)} ${escapeHtml(d.description || "")}</div>
            <div class="mood-tags">
                ${(d.emotions || []).map((t) => `<span class="tag-chip">情绪：${tagLabel(t)}</span>`).join("")}
                ${(d.tags || []).map((t) => `<span class="tag-chip">${tagLabel(t)}</span>`).join("")}
                ${(d.genres || []).map((g) => `<span class="genre-chip">${genreLabel(g)}</span>`).join("")}
            </div>
            ${renderGroupsHtml(songs, d.emotions)}
            <div class="mood-actions">
                <button class="btn-ghost btn-sm mood-refresh-btn" ${songs.length ? "" : "disabled"}>
                    ${ic("refresh", 12)} 换一批
                </button>
            </div>
            <div class="mood-follow">
                <span class="muted">继续追问：</span>
                ${FOLLOW_CHIPS.map((c) => `<button class="mood-follow-chip" data-q="${c}">${c}</button>`).join("")}
            </div>
        </div>`;
}

function renderGroupsHtml(songs, emotions) {
    if (!songs.length) {
        return `<div class="empty-hint">暂时没有匹配的歌曲，换个说法试试</div>`;
    }
    const main = songs.filter((s) => (s.tags || []).some((t) => (emotions || []).includes(t)));
    const rest = songs.filter((s) => !main.includes(s));
    let html = "";
    if (main.length) html += renderGroupHtml("🎯 最贴合你心情", main);
    const byGenre = {};
    rest.forEach((s) => {
        const g = s.genre || "other";
        (byGenre[g] = byGenre[g] || []).push(s);
    });
    Object.keys(byGenre).forEach((g) => {
        html += renderGroupHtml(
            g === "other" ? "🎵 其他" : `${genreIcon(g)} ${genreLabel(g)}`,
            byGenre[g],
        );
    });
    return `<div class="mood-groups">${html}</div>`;
}

function renderGroupHtml(label, songs) {
    return `
        <div class="mood-group">
            <div class="mood-group-title">${label}<span class="muted">（${songs.length}）</span></div>
            <div class="recommend-grid">${songs.map(songCard).join("")}</div>
        </div>`;
}

function songCard(s) {
    return `
        <div class="recommend-card" onclick="playMoodSong(${s.id})">
            <div class="rec-cover" style="${CoverGen.inlineStyle(s)}">
                ${s.cover ? `<img src="${s.cover}" alt="">` : `<span>♫</span>`}
                <span class="rec-play">${ic("play", 12)}</span>
            </div>
            <div class="rec-title">${escapeHtml(s.title)}</div>
            <div class="rec-artist muted">${escapeHtml(s.artist || "未知")}</div>
            ${s.reason ? `<div class="rec-reason">${escapeHtml(s.reason)}</div>` : ""}
        </div>`;
}

function genreIcon(g) {
    return (g === "instrumental" || g === "ambient" || g === "classical" || g === "lofi") ? "🎹"
        : (g === "rock" || g === "electronic" || g === "hiphop") ? "🎸" : "🎵";
}

function playMoodSong(id) {
    const idx = moodQueue.findIndex((s) => s.id === id);
    if (idx >= 0) window.player.playAtIndex(idx);
}

/* ---------- 事件绑定 ---------- */
document.addEventListener("DOMContentLoaded", () => {
    const chat = document.getElementById("mood-chat");
    if (chat) {
        chat.addEventListener("click", (e) => {
            const chip = e.target.closest(".mood-follow-chip");
            if (chip) { moodFollow(chip.dataset.q); return; }
            const refresh = e.target.closest(".mood-refresh-btn");
            if (refresh && !refresh.disabled) { moodRefresh(); return; }
        });
    }

    const chips = document.getElementById("mood-quick-chips");
    if (chips) {
        chips.innerHTML = QUICK_CHIPS
            .map((c) => `<button class="mood-chip" data-text="${c.text}">${c.icon} ${c.text}</button>`)
            .join("");
        chips.addEventListener("click", (e) => {
            const b = e.target.closest(".mood-chip");
            if (!b) return;
            const input = document.getElementById("mood-input");
            if (input) input.value = b.dataset.text;
            submitMood(b.dataset.text);
        });
    }
});
