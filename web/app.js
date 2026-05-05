(function () {
  const S = window.SongSchema;
  const engine = new window.AudioEngine();
  const canvas = document.getElementById("waveCanvas");
  const ctx2d = canvas.getContext("2d");
  const scoreCanvas = document.getElementById("scoreCanvas");
  const scoreCtx = scoreCanvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const elPitchSelect = document.getElementById("pitchSelect");
  const elAmp = document.getElementById("amp");
  const elAmpVal = document.getElementById("ampVal");
  const elUnitCount = document.getElementById("unitCount");
  const elUnitEdit = document.getElementById("unitEdit");
  const elEditTitle = document.getElementById("editTitle");
  const elTotalDur = document.getElementById("totalDur");
  const elChkNoise = document.getElementById("chkNoise");
  const elDurSelect = document.getElementById("durSelect");

  /** 0.2 s … 1.0 s，步长 0.1 */
  const DURATION_CHOICES = Array.from({ length: 9 }, (_, i) =>
    Math.round((0.2 + i * 0.1) * 10) / 10
  );

  /**
   * C 大调自然音列：自低 sol（G₃）向上至高 mi（E₅），共 13 级；与十二平均律、A₄=440 Hz 一致。
   */
  const PITCHES = [
    { syllable: "sol", hz: 196.0 },
    { syllable: "la", hz: 220.0 },
    { syllable: "si", hz: 246.94 },
    { syllable: "do", hz: 261.63 },
    { syllable: "re", hz: 293.66 },
    { syllable: "mi", hz: 329.63 },
    { syllable: "fa", hz: 349.23 },
    { syllable: "sol", hz: 392.0 },
    { syllable: "la", hz: 440.0 },
    { syllable: "si", hz: 493.88 },
    { syllable: "do", hz: 523.25 },
    { syllable: "re", hz: 587.33 },
    { syllable: "mi", hz: 659.25 },
  ];

  const MAX_UNITS = 16;
  const MIN_UNITS = 1;

  /** 总谱块颜色：方波 / 锯齿 */
  const SCORE_COLORS = {
    square: "#2563eb",
    sawtooth: "#16a34a",
  };
  /** @type {{ pitchIndex: number, wave: 'square'|'sawtooth', addNoise: boolean, durSec: number }[]} */
  let units = [];
  let currentUnitIndex = 0;

  function defaultUnit() {
    return { pitchIndex: 0, wave: "square", addNoise: false, durSec: 0.4 };
  }

  function clampDuration(sec) {
    const x = +sec;
    if (!Number.isFinite(x)) return 0.4;
    const ok = DURATION_CHOICES.find((d) => Math.abs(d - x) < 1e-6);
    if (ok != null) return ok;
    return DURATION_CHOICES.reduce((best, d) =>
      Math.abs(d - x) < Math.abs(best - x) ? d : best
    );
  }

  function totalTimelineSeconds() {
    let t = 0;
    for (let i = 0; i < units.length; i++) {
      t += clampDuration(units[i].durSec);
    }
    return t;
  }

  function setStatus(msg, isErr) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
  }

  function fillPitchSelect() {
    elPitchSelect.innerHTML = PITCHES.map(
      (p, i) =>
        `<option value="${i}">${p.syllable} · ${p.hz.toFixed(2)} Hz</option>`
    ).join("");
  }

  function fillDurSelect() {
    elDurSelect.innerHTML = DURATION_CHOICES.map(
      (d) =>
        `<option value="${d}"${d === 0.4 ? " selected" : ""}>${d.toFixed(1)} s</option>`
    ).join("");
  }

  function updateTotalDurationHint() {
    const t = totalTimelineSeconds();
    elTotalDur.textContent = units.length > 0 ? "总时长约 " + t.toFixed(1) + " s" : "";
  }
  function rebuildUnitSelect() {
    elUnitEdit.innerHTML = "";
    for (let i = 0; i < units.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = "单元 " + (i + 1);
      elUnitEdit.appendChild(opt);
    }
    elUnitEdit.value = String(currentUnitIndex);
    elEditTitle.textContent = "正在编辑：单元 " + (currentUnitIndex + 1);
    updateTotalDurationHint();
  }

  function applyUnitCount(n) {
    n = Math.max(MIN_UNITS, Math.min(MAX_UNITS, Math.floor(n)));
    elUnitCount.value = String(n);
    saveUiToUnit(currentUnitIndex);
    while (units.length < n) {
      units.push(defaultUnit());
    }
    while (units.length > n) {
      units.pop();
    }
    if (currentUnitIndex >= units.length) {
      currentUnitIndex = Math.max(0, units.length - 1);
    }
    rebuildUnitSelect();
    loadUnitToUi(currentUnitIndex);
  }

  function getWaveFromUi() {
    const r = document.querySelector('input[name="wave"]:checked');
    return r && r.value === "sawtooth" ? "sawtooth" : "square";
  }

  function setWaveInUi(w) {
    const val = w === "sawtooth" ? "sawtooth" : "square";
    const el = document.querySelector(`input[name="wave"][value="${val}"]`);
    if (el) el.checked = true;
  }

  function saveUiToUnit(u) {
    if (!units[u]) return;
    units[u].pitchIndex = Math.max(
      0,
      Math.min(PITCHES.length - 1, +elPitchSelect.value || 0)
    );
    units[u].wave = getWaveFromUi();
    units[u].addNoise = elChkNoise.checked;
    units[u].durSec = clampDuration(elDurSelect.value);
    updateTotalDurationHint();
    drawScore();
  }

  function loadUnitToUi(u) {
    const spec = units[u];
    elPitchSelect.value = String(spec.pitchIndex);
    setWaveInUi(spec.wave);
    elChkNoise.checked = !!spec.addNoise;
    elDurSelect.value = String(clampDuration(spec.durSec != null ? spec.durSec : 0.4));
    elEditTitle.textContent = "正在编辑：单元 " + (u + 1);
    drawScore();
  }

  function buildEventsFromUnit(u) {
    const spec = units[u];
    const p = PITCHES[spec.pitchIndex];
    const durSec = clampDuration(spec.durSec != null ? spec.durSec : 0.4);
    const ampPct = +elAmp.value || 70;
    const baseV = (ampPct / 100) * 12;
    const nVoices = 1 + (spec.addNoise ? 1 : 0);
    const scale = 1 / Math.sqrt(nVoices);
    const v = baseV * scale;

    const out = [
      {
        t: 0,
        ch: 0,
        n: 0,
        o: 4,
        v,
        d: 1,
        durSec,
        w: spec.wave,
        freqHz: p.hz,
      },
    ];

    if (spec.addNoise) {
      out.push({
        t: 0,
        ch: 0,
        n: 0,
        o: 4,
        v,
        d: 1,
        durSec,
        w: "noise",
        freqHz: p.hz,
      });
    }

    return out;
  }

  function buildFullTimeline() {
    saveUiToUnit(currentUnitIndex);
    const all = [];
    let gch = 0;
    let acc = 0;
    for (let u = 0; u < units.length; u++) {
      const startSec = acc;
      const du = clampDuration(units[u].durSec != null ? units[u].durSec : 0.4);
      const evs = buildEventsFromUnit(u);
      evs.forEach((e) => {
        all.push(Object.assign({}, e, { startSec, ch: gch++ }));
      });
      acc += du;
    }
    return all;
  }

  function validateList(list) {
    for (let i = 0; i < list.length; i++) {
      const ev = S.normalizeEvent(list[i]);
      const err = S.validateEvent(ev);
      if (err.length) return err.join("，");
    }
    return null;
  }

  function waveLabel(w) {
    return w === "sawtooth" ? "锯齿" : "方波";
  }

  function describeProgram() {
    return units
      .map((spec, u) => {
        const p = PITCHES[spec.pitchIndex];
        const ds = clampDuration(spec.durSec != null ? spec.durSec : 0.4);
        let s =
          "单元" + (u + 1) + "(" + ds.toFixed(1) + "s):" + p.syllable + "·" + waveLabel(spec.wave);
        if (spec.addNoise) s += "+噪";
        return s;
      })
      .join(" → ");
  }

  /** 与总谱绘制一致的布局（用于命中检测） */
  function getScoreLayout() {
    const W = scoreCanvas.width;
    const H = scoreCanvas.height;
    const padL = 40;
    const padR = 16;
    const padT = 22;
    const padB = 40;
    const innerW = Math.max(W - padL - padR, 10);
    const innerH = Math.max(H - padT - padB, 10);
    const baseY = padT + innerH;
    const nPitches = PITCHES.length;
    const rowH = innerH / nPitches;
    const total = Math.max(totalTimelineSeconds(), 0.05);
    const gapPx = 3;
    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      innerW,
      innerH,
      baseY,
      rowH,
      nPitches,
      total,
      gapPx,
    };
  }

  function getScoreUnitBlocks() {
    const L = getScoreLayout();
    let acc = 0;
    const blocks = [];
    for (let u = 0; u < units.length; u++) {
      const spec = units[u];
      const du = clampDuration(spec.durSec != null ? spec.durSec : 0.4);
      const x0 = L.padL + (acc / L.total) * L.innerW;
      const x1 = L.padL + ((acc + du) / L.total) * L.innerW;
      let bw = x1 - x0 - L.gapPx;
      if (bw < 6) bw = Math.max(x1 - x0 - 1, 4);
      const x = x0 + L.gapPx * 0.5;
      const pi = Math.max(0, Math.min(PITCHES.length - 1, spec.pitchIndex));
      const barH = L.rowH;
      const y = L.baseY - (pi + 1) * L.rowH;
      blocks.push({ u, x, y, bw, barH, pi, du });
      acc += du;
    }
    return { blocks, L };
  }

  function scoreEventToCanvasXY(e) {
    const r = scoreCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * scoreCanvas.width;
    const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * scoreCanvas.height;
    return { x, y };
  }

  function hitTestScoreUnit(canvasX, canvasY) {
    const { blocks } = getScoreUnitBlocks();
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (
        canvasX >= b.x &&
        canvasX <= b.x + b.bw &&
        canvasY >= b.y &&
        canvasY <= b.y + b.barH
      ) {
        return b.u;
      }
    }
    return -1;
  }

  /** 琴谱式总谱：横轴时间（宽∝时长），纵轴为唱名行（每音一行 / 钢琴卷帘），颜色∝波形 */
  function drawScore() {
    const { blocks, L } = getScoreUnitBlocks();

    scoreCtx.fillStyle = "#e4e9f0";
    scoreCtx.fillRect(0, 0, L.W, L.H);

    scoreCtx.strokeStyle = "#c5d0dc";
    scoreCtx.lineWidth = 1;
    for (let k = 0; k <= L.nPitches; k++) {
      const y = L.baseY - k * L.rowH;
      scoreCtx.setLineDash(k === 0 ? [] : [4, 5]);
      scoreCtx.beginPath();
      scoreCtx.moveTo(L.padL, y);
      scoreCtx.lineTo(L.W - L.padR, y);
      scoreCtx.stroke();
    }
    scoreCtx.setLineDash([]);

    scoreCtx.fillStyle = "#5a6b7d";
    scoreCtx.font = "10px Segoe UI, system-ui, sans-serif";
    scoreCtx.textAlign = "right";
    scoreCtx.textBaseline = "middle";
    for (let i = 0; i < PITCHES.length; i++) {
      const yMid = L.baseY - (i + 0.5) * L.rowH;
      scoreCtx.fillText(PITCHES[i].syllable, L.padL - 6, yMid);
    }
    scoreCtx.textAlign = "left";
    scoreCtx.textBaseline = "alphabetic";

    for (const b of blocks) {
      const spec = units[b.u];
      const { u, x, y, bw, barH, pi, du } = b;

      const col = spec.wave === "sawtooth" ? SCORE_COLORS.sawtooth : SCORE_COLORS.square;
      scoreCtx.fillStyle = col;
      scoreCtx.fillRect(x, y, bw, barH);

      if (spec.addNoise) {
        scoreCtx.save();
        scoreCtx.strokeStyle = "rgba(230, 180, 80, 0.55)";
        scoreCtx.lineWidth = 1.2;
        const step = 7;
        for (let hx = x; hx < x + bw + step; hx += step) {
          scoreCtx.beginPath();
          scoreCtx.moveTo(hx, y + barH);
          scoreCtx.lineTo(hx + step * 0.85, y);
          scoreCtx.stroke();
        }
        scoreCtx.restore();
        scoreCtx.strokeStyle = "#e6b450";
        scoreCtx.lineWidth = 2;
        scoreCtx.strokeRect(x + 0.5, y + 0.5, bw - 1, barH - 1);
      }

      /* 每行高度较薄：窄块单行小字，否则两行 */
      scoreCtx.lineJoin = "round";
      scoreCtx.miterLimit = 2;
      scoreCtx.strokeStyle = "rgba(0, 0, 0, 0.38)";
      scoreCtx.lineWidth = 2.5;
      scoreCtx.fillStyle = "#ffffff";
      const twoLine = barH >= 24 && bw > 40;
      if (twoLine) {
        scoreCtx.font = "bold 11px Segoe UI, system-ui, sans-serif";
        const label1 = String(u + 1);
        scoreCtx.strokeText(label1, x + 4, y + 14);
        scoreCtx.fillText(label1, x + 4, y + 14);
        scoreCtx.font = "10px Segoe UI, system-ui, sans-serif";
        const label2 = PITCHES[pi].syllable + " " + du.toFixed(1) + "s";
        scoreCtx.strokeText(label2, x + 4, y + 26);
        scoreCtx.fillText(label2, x + 4, y + 26);
      } else {
        scoreCtx.font = "bold 9px Segoe UI, system-ui, sans-serif";
        const ty = y + Math.max(11, barH * 0.58);
        let t =
          String(u + 1) + " " + PITCHES[pi].syllable + " " + du.toFixed(1) + "s";
        if (bw < 52 && t.length > 10) t = String(u + 1);
        scoreCtx.strokeText(t, x + 3, ty);
        scoreCtx.fillText(t, x + 3, ty);
      }

      if (u === currentUnitIndex) {
        scoreCtx.strokeStyle = "#1d6fd4";
        scoreCtx.lineWidth = 2.5;
        scoreCtx.strokeRect(x - 1, y - 1, bw + 2, barH + 2);
      }
    }

    scoreCtx.fillStyle = "#5a6b7d";
    scoreCtx.font = "10px Segoe UI, system-ui, sans-serif";
    scoreCtx.textAlign = "center";
    scoreCtx.fillText("时间 →", L.padL + L.innerW * 0.5, L.H - 12);
    scoreCtx.textAlign = "left";
    scoreCtx.fillText("0", L.padL, L.H - 12);
    scoreCtx.textAlign = "right";
    scoreCtx.fillText(L.total.toFixed(1) + " s", L.W - L.padR, L.H - 12);
    scoreCtx.textAlign = "left";

    scoreCtx.save();
    scoreCtx.translate(12, L.padT + L.innerH * 0.45);
    scoreCtx.rotate(-Math.PI / 2);
    scoreCtx.fillStyle = "#5a6b7d";
    scoreCtx.font = "10px Segoe UI, system-ui, sans-serif";
    scoreCtx.textAlign = "center";
    scoreCtx.fillText("音高 ↑", 0, 0);
    scoreCtx.restore();
  }

  function drawWave() {
    const w = canvas.width;
    const h = canvas.height;
    const analyser = engine.getAnalyser();
    if (!analyser || !engine.ctx) {
      ctx2d.fillStyle = "#e4e9f0";
      ctx2d.fillRect(0, 0, w, h);
      return;
    }
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    ctx2d.fillStyle = "#e4e9f0";
    ctx2d.fillRect(0, 0, w, h);
    const spec = units[currentUnitIndex];
    const wv = spec && spec.wave === "sawtooth" ? "sawtooth" : "square";
    ctx2d.strokeStyle = SCORE_COLORS[wv];
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();
    const mid = h / 2;
    for (let i = 0; i < buf.length; i++) {
      const x = (i / (buf.length - 1)) * w;
      const y = mid + ((buf[i] - 128) / 128) * (mid - 4);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.strokeStyle = "#b0becd";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, mid);
    ctx2d.lineTo(w, mid);
    ctx2d.stroke();
  }

  function loop() {
    drawWave();
    requestAnimationFrame(loop);
  }

  elAmp.addEventListener("input", () => {
    elAmpVal.textContent = elAmp.value + "%";
  });

  elUnitCount.addEventListener("change", () => {
    applyUnitCount(+elUnitCount.value);
  });

  elUnitEdit.addEventListener("change", () => {
    saveUiToUnit(currentUnitIndex);
    currentUnitIndex = +elUnitEdit.value;
    loadUnitToUi(currentUnitIndex);
  });

  elPitchSelect.addEventListener("change", () => {
    saveUiToUnit(currentUnitIndex);
  });

  document.querySelectorAll('input[name="wave"]').forEach((r) => {
    r.addEventListener("change", () => {
      saveUiToUnit(currentUnitIndex);
    });
  });

  elChkNoise.addEventListener("change", () => {
    saveUiToUnit(currentUnitIndex);
  });

  elDurSelect.addEventListener("change", () => {
    saveUiToUnit(currentUnitIndex);
  });

  scoreCanvas.addEventListener("click", (e) => {
    const { x, y } = scoreEventToCanvasXY(e);
    const u = hitTestScoreUnit(x, y);
    if (u < 0) return;
    saveUiToUnit(currentUnitIndex);
    currentUnitIndex = u;
    elUnitEdit.value = String(u);
    loadUnitToUi(u);
    setStatus("已切换到单元 " + (u + 1) + "，可在下方修改参数。");
    const editPanel = document.querySelector(".edit-simple");
    if (editPanel) editPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  scoreCanvas.addEventListener("mousemove", (e) => {
    const { x, y } = scoreEventToCanvasXY(e);
    scoreCanvas.style.cursor = hitTestScoreUnit(x, y) >= 0 ? "pointer" : "default";
  });
  scoreCanvas.addEventListener("mouseleave", () => {
    scoreCanvas.style.cursor = "default";
  });

  document.getElementById("btnPlay").addEventListener("click", async () => {
    const list = buildFullTimeline();
    const verr = validateList(list);
    if (verr) {
      setStatus(verr, true);
      return;
    }
    setStatus("依次播放：" + describeProgram());
    try {
      await engine.play(list);
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  });

  document.getElementById("btnStop").addEventListener("click", () => {
    engine.stop();
    setStatus("已停止");
  });

  document.getElementById("btnClear").addEventListener("click", () => {
    units[currentUnitIndex] = defaultUnit();
    loadUnitToUi(currentUnitIndex);
    setStatus(
      "当前单元已重置为 " +
        PITCHES[0].syllable +
        " · " +
        PITCHES[0].hz.toFixed(2) +
        " Hz · 0.4 s · 方波（无噪声）"
    );
  });

  document.getElementById("btnExportWav").addEventListener("click", async () => {
    const list = buildFullTimeline();
    const verr = validateList(list);
    if (verr) {
      setStatus(verr, true);
      return;
    }
    setStatus("正在渲染 WAV…");
    try {
      const blob = await engine.renderWav(list, totalTimelineSeconds());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ucug1903_units.wav";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("已导出 ucug1903_units.wav");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  });

  fillPitchSelect();
  fillDurSelect();
  units = [defaultUnit()];
  rebuildUnitSelect();
  loadUnitToUi(0);
  setStatus("为每个单元选择音高、时长、波形，可选叠加噪声，然后依次播放。");
  loop();
})();
