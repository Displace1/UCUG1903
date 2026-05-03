(function () {
  const S = window.SongSchema;
  const engine = new window.AudioEngine();
  const tbody = document.getElementById("tbody");
  const canvas = document.getElementById("waveCanvas");
  const ctx2d = canvas.getContext("2d");
  const statusEl = document.getElementById("status");

  let events = [];
  let animId = 0;

  function setStatus(msg, isErr) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
  }

  function freqCell(ev) {
    if (S.isRest(S.normalizeEvent(ev))) return "—";
    const n = S.normalizeEvent(ev);
    return S.eventFrequency(n).toFixed(1);
  }

  function waveOptions(selected) {
    const opts = [
      ["square", "方波"],
      ["sawtooth", "锯齿"],
      ["noise", "噪声(近似)"],
      ["sine", "正弦(对比)"],
    ];
    return opts
      .map(
        ([v, label]) =>
          `<option value="${v}" ${v === selected ? "selected" : ""}>${label}</option>`
      )
      .join("");
  }

  function rowHtml(index, ev) {
    const n = S.normalizeEvent(ev);
    const raw = Array.isArray(ev) ? ev : [n.t, n.ch, n.n, n.o, n.v, n.d, n.w];
    return `
      <tr data-i="${index}">
        <td>${index + 1}</td>
        <td><input type="number" min="0" step="1" data-f="t" value="${n.t}" /></td>
        <td><input type="number" min="0" step="1" data-f="ch" value="${n.ch}" /></td>
        <td><input type="number" min="0" max="11" step="1" data-f="n" value="${n.n}" /></td>
        <td><input type="number" min="0" max="8" step="1" data-f="o" value="${n.o}" /></td>
        <td><input type="number" min="0" max="15" step="1" data-f="v" value="${n.v}" /></td>
        <td><input type="number" min="1" step="1" data-f="d" value="${n.d}" /></td>
        <td><select data-f="w">${waveOptions(n.w)}</select></td>
        <td class="freq">${freqCell(raw)}</td>
        <td class="row-actions"><button type="button" class="danger row-del">删</button></td>
      </tr>`;
  }

  function readEventsFromDom() {
    const rows = tbody.querySelectorAll("tr");
    const out = [];
    rows.forEach((tr) => {
      const get = (sel) => tr.querySelector(sel);
      const t = +get('[data-f="t"]').value;
      const ch = +get('[data-f="ch"]').value;
      const n = +get('[data-f="n"]').value;
      const o = +get('[data-f="o"]').value;
      const v = +get('[data-f="v"]').value;
      const d = +get('[data-f="d"]').value;
      const w = get('[data-f="w"]').value;
      out.push([t, ch, n, o, v, d, w]);
    });
    return out;
  }

  function refreshFreqCells() {
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((tr) => {
      const get = (sel) => tr.querySelector(sel);
      const ev = [
        +get('[data-f="t"]').value,
        +get('[data-f="ch"]').value,
        +get('[data-f="n"]').value,
        +get('[data-f="o"]').value,
        +get('[data-f="v"]').value,
        +get('[data-f="d"]').value,
        get('[data-f="w"]').value,
      ];
      tr.querySelector(".freq").textContent = freqCell(ev);
    });
  }

  function render() {
    tbody.innerHTML = events.map((e, i) => rowHtml(i, e)).join("");
    tbody.querySelectorAll("input,select").forEach((el) => {
      el.addEventListener("input", refreshFreqCells);
      el.addEventListener("change", refreshFreqCells);
    });
    tbody.querySelectorAll(".row-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tr = btn.closest("tr");
        const i = +tr.dataset.i;
        events.splice(i, 1);
        render();
        setStatus("");
      });
    });
  }

  function validateAll(list) {
    for (let i = 0; i < list.length; i++) {
      const ev = S.normalizeEvent(list[i]);
      const err = S.validateEvent(ev);
      if (err.length) return `第 ${i + 1} 行：${err.join("，")}`;
    }
    return null;
  }

  async function loadDefault() {
    const res = await fetch("default-song.json");
    if (!res.ok) throw new Error("无法加载 default-song.json");
    events = await res.json();
    render();
  }

  function drawWave() {
    const w = canvas.width;
    const h = canvas.height;
    const analyser = engine.getAnalyser();
    if (!analyser || !engine.ctx) {
      ctx2d.fillStyle = "#0a0e12";
      ctx2d.fillRect(0, 0, w, h);
      return;
    }
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    ctx2d.fillStyle = "#0a0e12";
    ctx2d.fillRect(0, 0, w, h);
    ctx2d.strokeStyle = "#5eb3d4";
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
    ctx2d.strokeStyle = "#2d3a4d";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(0, mid);
    ctx2d.lineTo(w, mid);
    ctx2d.stroke();
  }

  function loop() {
    drawWave();
    animId = requestAnimationFrame(loop);
  }

  document.getElementById("btnPlay").addEventListener("click", async () => {
    events = readEventsFromDom();
    const err = validateAll(events);
    if (err) {
      setStatus(err, true);
      return;
    }
    setStatus("播放中…");
    try {
      await engine.play(events);
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  });

  document.getElementById("btnStop").addEventListener("click", () => {
    engine.stop();
    setStatus("已停止");
  });

  document.getElementById("btnAddRow").addEventListener("click", () => {
    events = readEventsFromDom();
    const last = events.length ? S.normalizeEvent(events[events.length - 1]) : { t: 0, ch: 0, d: 1 };
    const nextT = last.t + last.d;
    events.push([nextT, 0, 0, 3, 12, 1, "square"]);
    render();
  });

  document.getElementById("btnReset").addEventListener("click", async () => {
    try {
      await loadDefault();
      setStatus("已加载默认曲（与 GameSong.SONG_DATA 一致）");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  });

  document.getElementById("btnExportJson").addEventListener("click", () => {
    events = readEventsFromDom();
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "song.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("已导出 song.json");
  });

  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("fileJson").click();
  });

  document.getElementById("fileJson").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw new Error("JSON 须为数组");
        events = data;
        render();
        setStatus("已导入 JSON");
      } catch (err) {
        setStatus("导入失败：" + (err.message || err), true);
      }
    };
    r.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btnCopyJava").addEventListener("click", async () => {
    events = readEventsFromDom();
    const err = validateAll(events);
    if (err) {
      setStatus(err, true);
      return;
    }
    const lines = events.map((ev) => {
      const n = S.normalizeEvent(ev);
      const w = `, "${n.w}"`;
      return `      {${n.t}, ${n.ch}, ${n.n}, ${n.o}, ${n.v}, ${n.d}${w}},`;
    });
    const text =
      "// 若只需 Java 数组，请去掉每行末尾的波形字符串再粘贴到 int[][]\n" + lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制到剪贴板（含波形字符串，Java int[][] 需手动删第七列或改为 String）");
    } catch {
      setStatus("复制失败，请手动选择控制台中的数组", true);
      console.log(text);
    }
  });

  document.getElementById("btnExportWav").addEventListener("click", async () => {
    events = readEventsFromDom();
    const verr = validateAll(events);
    if (verr) {
      setStatus(verr, true);
      return;
    }
    setStatus("正在渲染 WAV…");
    try {
      const blob = await engine.renderWav(events);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ucug1903_export.wav";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("已导出 ucug1903_export.wav（与当前表格一致）");
    } catch (e) {
      setStatus(String(e.message || e), true);
    }
  });

  loadDefault()
    .then(() => setStatus("就绪。请用本地服务器打开（见 README），以便加载 default-song.json。"))
    .catch(() => {
      events = [
        [4, 0, 4, 3, 12, 1, "square"],
        [5, 0, 5, 3, 12, 1, "square"],
        [6, 0, 7, 3, 12, 3, "square"],
      ];
      render();
      setStatus("无法 fetch 默认曲，已填入最短示例。请使用 npx serve web 等方式启动。");
    });

  loop();
})();
