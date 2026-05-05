/**
 * Play and offline-render chip-style events. Default timbres: square / sawtooth / noise; sine optional.
 */
(function (global) {
  const S = global.SongSchema;
  const SAMPLE_RATE = 44100;

  function noiseBuffer(ctx, seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Peak voice gain; ~8 overlapping notes before clip */
  function voiceGainScalar(volume) {
    return 0.14 * Math.min(1, volume / 12);
  }

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.activeNodes = [];
    this.playBaseTime = 0;
  }

  AudioEngine.prototype.ensureContext = function () {
    if (!this.ctx) {
      this.ctx = new (global.AudioContext || global.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.65;
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    return this.ctx;
  };

  AudioEngine.prototype.play = function (events) {
    this.stopVoiceNodes();
    const ctx = this.ensureContext();
    const lead = 0.08;
    this.playBaseTime = ctx.currentTime + lead;
    const offset = this.playBaseTime;
    const nodes = [];
    const normalized = events.map((e) => S.normalizeEvent(e));
    normalized.sort((a, b) => S.eventStartSeconds(a) - S.eventStartSeconds(b));
    for (const ev of normalized) {
      if (S.isRest(ev)) continue;
      scheduleEventAt(ctx, ev, this.master, offset, nodes);
    }
    this.activeNodes = nodes;
    return ctx.resume();
  };

  function scheduleEventAt(ctx, ev, masterGain, audioTimeZero, nodesOut) {
    if (S.isRest(ev)) return;
    const dur = S.eventDurationSeconds(ev);
    const g = voiceGainScalar(ev.v);
    if (g <= 0) return;
    const t0 = audioTimeZero + S.eventStartSeconds(ev);
    const t1 = t0 + dur;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t0);
    env.gain.linearRampToValueAtTime(g, t0 + Math.min(0.005, dur * 0.1));
    env.gain.setValueAtTime(g, t1 - Math.min(0.01, dur * 0.15));
    env.gain.linearRampToValueAtTime(0.001, t1);
    env.connect(masterGain);
    nodesOut.push(env);

    if (ev.w === "noise") {
      const nb = noiseBuffer(ctx, Math.min(2, dur + 0.5));
      const src = ctx.createBufferSource();
      src.buffer = nb;
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "lowpass";
      const fc =
        ev.freqHz != null && ev.freqHz > 0
          ? Math.min(10000, Math.max(400, ev.freqHz * 6))
          : 6000;
      band.frequency.setValueAtTime(fc, t0);
      src.connect(band);
      band.connect(env);
      src.start(t0);
      src.stop(t1 + 0.02);
      nodesOut.push(src, band);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = ev.w === "sine" ? "sine" : ev.w === "sawtooth" ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(S.eventFrequency(ev), t0);
    osc.connect(env);
    osc.start(t0);
    osc.stop(t1 + 0.02);
    nodesOut.push(osc);
  }

  AudioEngine.prototype.stopVoiceNodes = function () {
    for (const n of this.activeNodes) {
      try {
        n.disconnect();
        if (typeof n.stop === "function") n.stop(0);
      } catch (_) {}
    }
    this.activeNodes = [];
  };

  AudioEngine.prototype.stop = function () {
    this.stopVoiceNodes();
  };

  /**
   * @returns {Promise<Blob>}
   * @param {number} [minTotalSec] 含空单元的总占位时长（秒），导出 WAV 不短于此
   */
  AudioEngine.prototype.renderWav = async function (events, minTotalSec) {
    let duration = S.songEndSeconds(events);
    if (minTotalSec != null && Number.isFinite(minTotalSec)) {
      const need = minTotalSec + 0.15;
      if (need > duration) duration = need;
    }
    const length = Math.ceil(SAMPLE_RATE * duration);
    const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
    const master = offline.createGain();
    master.gain.value = 1;
    master.connect(offline.destination);
    const nodes = [];
    const normalized = events.map((e) => S.normalizeEvent(e));
    normalized.sort((a, b) => S.eventStartSeconds(a) - S.eventStartSeconds(b));
    for (const ev of normalized) {
      if (S.isRest(ev)) continue;
      scheduleEventAt(offline, ev, master, offline.currentTime, nodes);
    }
    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  };

  function audioBufferToWavBlob(buffer) {
    const numCh = buffer.numberOfChannels;
    const bits = 16;
    const samples = buffer.length;
    const bytesPerSample = bits / 8;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = samples * blockAlign;
    const ab = new ArrayBuffer(44 + dataSize);
    const v = new DataView(ab);
    let o = 0;
    writeStr(v, o, "RIFF");
    o += 4;
    v.setUint32(o, 36 + dataSize, true);
    o += 4;
    writeStr(v, o, "WAVE");
    o += 4;
    writeStr(v, o, "fmt ");
    o += 4;
    v.setUint32(o, 16, true);
    o += 4;
    v.setUint16(o, 1, true);
    o += 2;
    v.setUint16(o, numCh, true);
    o += 2;
    v.setUint32(o, buffer.sampleRate, true);
    o += 4;
    v.setUint32(o, buffer.sampleRate * blockAlign, true);
    o += 4;
    v.setUint16(o, blockAlign, true);
    o += 2;
    v.setUint16(o, bits, true);
    o += 2;
    writeStr(v, o, "data");
    o += 4;
    v.setUint32(o, dataSize, true);
    o += 4;
    const ch0 = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, ch0[i]));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  function writeStr(view, offset, s) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  AudioEngine.prototype.getAnalyser = function () {
    return this.analyser;
  };

  global.AudioEngine = AudioEngine;
})(typeof window !== "undefined" ? window : globalThis);
