/* ========== 板块8 · 实时频谱可视化 ==========
 * 通过 Web Audio API 捕获播放器音频，绘制实时频谱柱状图
 * 完全本地计算，无任何外部依赖
 */
(function () {
    "use strict";

    const canvas = document.getElementById("spectrum");
    if (!canvas) return;
    const cctx = canvas.getContext("2d");
    const data = new Uint8Array(128);
    let analyser = null;
    let audioCtx = null;
    let started = false;

    const STORE_KEY = "yunly.spectrum.minimized";   // 收起状态持久化

    function _applyMinimized(min) {
        canvas.classList.toggle("minimized", min);
        document.documentElement.style.setProperty("--spectrum-h", min ? "2px" : "130px");
        const btn = document.getElementById("btn-spectrum");
        if (btn) {
            btn.classList.toggle("active", !min);
            btn.title = min ? "展开频谱" : "收起频谱";
        }
    }

    function _setupToggle() {
        const btn = document.getElementById("btn-spectrum");
        if (!btn) return;
        btn.innerHTML = ic("spectrum", 17);
        try {
            _applyMinimized(localStorage.getItem(STORE_KEY) === "1");
        } catch (e) { /* ignore */ }
        btn.addEventListener("click", () => {
            const min = !canvas.classList.contains("minimized");
            _applyMinimized(min);
            try {
                localStorage.setItem(STORE_KEY, min ? "1" : "0");
            } catch (e) { /* ignore */ }
        });
    }

    function init() {
        const audio = window.player && window.player.audio;
        if (!audio) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            audioCtx = new AC();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.82;
            audioCtx.createMediaElementSource(audio).connect(analyser);
            // 频谱数据源之后接均衡器链（analyser -> EQ -> destination）
            _buildEqChain();
        } catch (e) {
            /* createMediaElementSource 只能调用一次，失败则静默降级 */
        }
        _setupToggle();
    }

    /* 均衡器 5 频段：低架 250Hz / 峰值 500Hz / 1kHz / 3kHz / 高架 8kHz
     * 与频谱共用同一个 AudioContext + source（createMediaElementSource 只能调用一次） */
    let eqNodes = null;

    function _buildEqChain() {
        if (!audioCtx || !analyser) return;
        const defs = [
            ["lowshelf", 250],
            ["peaking", 500],
            ["peaking", 1000],
            ["peaking", 3000],
            ["highshelf", 8000],
        ];
        eqNodes = [];
        let prev = analyser;
        for (const [type, freq] of defs) {
            const f = audioCtx.createBiquadFilter();
            f.type = type;
            f.frequency.value = freq;
            f.Q.value = 1.0;
            f.gain.value = 0;
            prev.connect(f);
            prev = f;
            eqNodes.push(f);
        }
        prev.connect(audioCtx.destination);
    }

    /* 均衡器控制接口（供 eq.js 调用） */
    window.__audioGraph = {
        setEq(gains) {
            if (!eqNodes || !Array.isArray(gains)) return;
            for (let i = 0; i < eqNodes.length && i < gains.length; i++) {
                eqNodes[i].gain.value = Number(gains[i]) || 0;
            }
        },
    };

    function fit() {
        const r = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(r.width * dpr);
        const h = Math.round(r.height * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", fit);
    fit();

    function draw() {
        requestAnimationFrame(draw);
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        cctx.clearRect(0, 0, W, H);

        // 播放时确保音频上下文运行
        if (analyser && audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
        if (!analyser) return;

        analyser.getByteFrequencyData(data);
        const bars = 96;
        const gap = 2;
        const bw = (W - gap * (bars - 1)) / bars;
        const per = data.length / bars;

        for (let i = 0; i < bars; i++) {
            let sum = 0;
            for (let j = 0; j < per; j++) sum += data[(i * per + j) | 0];
            const v = sum / per;
            const h = Math.max(3, (v / 255) * H * 0.92);
            const x = i * (bw + gap);
            const y = H - h;
            const grad = cctx.createLinearGradient(0, y, 0, H);
            grad.addColorStop(0, "#ec4141");
            grad.addColorStop(0.6, "#ff6b5e");
            grad.addColorStop(1, "#ffb14d");
            cctx.fillStyle = grad;
            const r = Math.min(bw / 2, 3);
            cctx.beginPath();
            cctx.moveTo(x, y + r);
            cctx.arcTo(x, y, x + r, y, r);
            cctx.lineTo(x + bw - r, y);
            cctx.arcTo(x + bw, y, x + bw, y + r, r);
            cctx.lineTo(x + bw, H);
            cctx.lineTo(x, H);
            cctx.closePath();
            cctx.fill();
        }
    }

    if (window.player) {
        init();
    } else {
        document.addEventListener("DOMContentLoaded", init);
    }
    draw();

    /* ---------- 设置面板控制接口 ---------- */
    window.SpectrumBar = {
        isMinimized: () => canvas.classList.contains("minimized"),
        setMinimized(min) {
            if (canvas.classList.contains("minimized") !== !!min) {
                _applyMinimized(min);
                try { localStorage.setItem(STORE_KEY, min ? "1" : "0"); } catch (e) { /* ignore */ }
            }
        },
    };
})();
