/**
 * UCUG1903 chip-style song schema (aligned with GameSong.java).
 * Optional: freqHz, durSec, startSec（秒，与 tick 起点相加）
 */
(function (global) {
  const TICK_SECONDS = 0.06;

  function isRest(ev) {
    const v = ev.v != null ? ev.v : ev.volume;
    const n = ev.n != null ? ev.n : ev.note;
    if (v <= 0) return true;
    if (ev.freqHz != null && Number.isFinite(ev.freqHz) && ev.freqHz > 0) return false;
    if (n >= 12) return true;
    return false;
  }

  function noteToMidi(octave, note) {
    return 12 * (octave + 1) + note;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function eventFrequency(ev) {
    if (ev.freqHz != null && Number.isFinite(ev.freqHz) && ev.freqHz > 0) {
      return ev.freqHz;
    }
    const o = ev.o != null ? ev.o : ev.octave;
    const n = ev.n != null ? ev.n : ev.note;
    return midiToFreq(noteToMidi(o, n));
  }

  function ticksToSeconds(ticks) {
    return ticks * TICK_SECONDS;
  }

  function eventDurationSeconds(ev) {
    if (ev.durSec != null && Number.isFinite(ev.durSec) && ev.durSec > 0) {
      return ev.durSec;
    }
    return ticksToSeconds(ev.d);
  }

  /** tick 起点 + startSec（秒） */
  function eventStartSeconds(ev) {
    const extra = ev.startSec != null && Number.isFinite(ev.startSec) ? ev.startSec : 0;
    return ticksToSeconds(ev.t) + extra;
  }

  function normalizeEvent(raw) {
    let t, ch, n, o, v, d, w, freqHz, durSec, startSec;
    if (Array.isArray(raw)) {
      t = raw[0];
      ch = raw[1];
      n = raw[2];
      o = raw[3];
      v = raw[4];
      d = raw[5];
      w = raw[6];
      freqHz = raw.length >= 8 ? raw[7] : null;
      durSec = raw.length >= 9 ? raw[8] : null;
      startSec = raw.length >= 10 ? raw[9] : null;
    } else {
      t = raw.t != null ? raw.t : raw.startTime;
      ch = raw.ch != null ? raw.ch : raw.channel;
      n = raw.n != null ? raw.n : raw.note;
      o = raw.o != null ? raw.o : raw.octave;
      v = raw.v != null ? raw.v : raw.volume;
      d = raw.d != null ? raw.d : raw.duration;
      w = raw.w != null ? raw.w : raw.wave;
      freqHz = raw.freqHz != null ? raw.freqHz : raw.f;
      durSec = raw.durSec != null ? raw.durSec : raw.durationSec;
      startSec = raw.startSec != null ? raw.startSec : raw.tSec;
    }
    const wave = typeof w === "string" && w ? w.toLowerCase() : "square";
    const allowed = ["square", "sawtooth", "noise", "sine"];
    const waveType = allowed.includes(wave) ? wave : "square";
    const out = { t: +t, ch: +ch, n: +n, o: +o, v: +v, d: +d, w: waveType };
    if (freqHz != null && freqHz !== "") {
      const fh = +freqHz;
      if (Number.isFinite(fh) && fh > 0) out.freqHz = fh;
    }
    if (durSec != null && durSec !== "") {
      const ds = +durSec;
      if (Number.isFinite(ds) && ds > 0) out.durSec = ds;
    }
    if (startSec != null && startSec !== "") {
      const ss = +startSec;
      if (Number.isFinite(ss)) out.startSec = ss;
    }
    return out;
  }

  function validateEvent(ev) {
    const err = [];
    if (!Number.isFinite(ev.t) || ev.t < 0) err.push("start tick >= 0");
    const hasDurSec = ev.durSec != null && Number.isFinite(ev.durSec) && ev.durSec > 0;
    if (!hasDurSec && (!Number.isFinite(ev.d) || ev.d <= 0)) err.push("duration > 0");
    if (!Number.isFinite(ev.v)) err.push("volume");
    if (ev.startSec != null && ev.startSec !== undefined && (!Number.isFinite(ev.startSec) || ev.startSec < 0)) {
      err.push("startSec >= 0");
    }
    if (ev.freqHz != null && ev.freqHz > 0) {
      if (ev.freqHz < 20 || ev.freqHz > 20000) err.push("频率 20–20000 Hz");
    } else {
      if (!Number.isFinite(ev.n)) err.push("note");
      if (!Number.isFinite(ev.o)) err.push("octave");
    }
    return err;
  }

  function songEndSeconds(events) {
    let max = 0;
    for (const raw of events) {
      const ev = normalizeEvent(raw);
      const start = eventStartSeconds(ev);
      const end = start + eventDurationSeconds(ev);
      if (end > max) max = end;
    }
    return max + 0.15;
  }

  global.SongSchema = {
    TICK_SECONDS,
    isRest,
    noteToMidi,
    midiToFreq,
    eventFrequency,
    ticksToSeconds,
    eventDurationSeconds,
    eventStartSeconds,
    normalizeEvent,
    validateEvent,
    songEndSeconds,
  };
})(typeof window !== "undefined" ? window : globalThis);
