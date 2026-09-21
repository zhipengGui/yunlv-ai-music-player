/* ========== 板块8 · 语音点歌 ==========
 * Web Speech API 识别 -> 后端解析 -> 复用现有搜索/播放队列
 * 浏览器不支持语音时，可用快捷指令按钮兜底
 */
(function () {
    "use strict";

    const voiceBtn = document.getElementById("voice-btn");
    const statusEl = document.getElementById("voice-status");
    const statusText = document.getElementById("voice-status-text");
    let recognition = null;

    function setStatus(text) {
        if (!statusText) return;
        statusText.textContent = text;
        statusEl.style.display = "flex";
    }

    function stopUI() {
        if (voiceBtn) {
            voiceBtn.classList.remove("listening");
            voiceBtn.innerHTML = ic("mic", 15) + " 语音点歌";
        }
        setTimeout(() => { if (statusEl) statusEl.style.display = "none"; }, 3500);
    }

    function initSpeech() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return false;
        recognition = new SR();
        recognition.lang = "zh-CN";
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            submitVoice(text);
        };
        recognition.onerror = () => { setStatus("识别失败，请再试一次"); stopUI(); };
        recognition.onend = () => stopUI();
        return true;
    }

    function startListening() {
        if (!recognition && !initSpeech()) {
            alert("当前浏览器不支持语音识别，请使用 Chrome / Edge 浏览器，或直接点击下方快捷指令按钮。");
            return;
        }
        try {
            recognition.start();
            voiceBtn.classList.add("listening");
            voiceBtn.innerHTML = ic("mic", 15) + " 聆听中…";
            setStatus("正在聆听，请说出想听的歌，例如『放一首舒缓的歌』");
        } catch (e) { /* 已在识别中，忽略 */ }
    }

    function submitVoice(text) {
        setStatus(`识别到：「${text}」，正在找歌…`);
        API.voice(text).then((d) => {
            setStatus(`「${text}」 → ${d.hint}`);
            if (d.songs && d.songs.length) {
                showVoiceResults(d.songs, d.hint);
            }
        }).catch(() => setStatus("语音点歌请求失败，请稍后再试"));
    }

    /* 切回发现视图展示点歌结果并自动播放第一首 */
    function showVoiceResults(songs, hint) {
        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        const discover = document.getElementById("view-discover");
        if (discover) discover.classList.add("active");
        const navBtn = document.querySelector('.nav-item[data-view="discover"]');
        if (navBtn) navBtn.classList.add("active");

        document.getElementById("discover-title").textContent = hint;
        document.getElementById("song-count").textContent = songs.length + " 首";
        document.getElementById("search-hint").style.display = "none";
        renderSongList(document.getElementById("song-list"), songs);
        window.player.loadQueue(songs);
        window._currentQueue = songs;
        if (songs.length) window.player.playAtIndex(0);
    }

    if (voiceBtn) {
        voiceBtn.innerHTML = ic("mic", 15) + " 语音点歌";
        voiceBtn.addEventListener("click", startListening);
        voiceBtn.classList.add("voice-btn-ready");
    }

    /* 快捷指令兜底：直接走解析接口 */
    document.querySelectorAll(".quick-chip").forEach((chip) => {
        chip.addEventListener("click", () => submitVoice(chip.dataset.voice));
    });
})();
