/**
 * UCUG1903 chip-style song schema (aligned with GameSong.java).
 * Format: startTime (ticks), channel, note (0–11 semitone from C), octave, volume, duration (ticks).
 * Optional 7th: waveform — square | sawtooth | noise | sine (sine for A/B对比 only).
 * 1 tick = 0.06 s
 */
(function (global) {
  const TICK_SECONDS = 0.06;

  function isRest(ev) {
    const v = ev.v != null ? ev.v : ev.volume;
    const n = ev.n != null ? ev.n : ev.note;
    if (v <= 0) return true;
    if (n >= 12) return true;
    return false;
  }

  /** Same convention as web demo: MIDI = 12*(octave+1) + note → E3 = 52 for octave 3 note 4 */
  function noteToMidi(octave, note) {
    return 12 * (octave + 1) + note;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function eventFrequency(ev) {
    const o = ev.o != null ? ev.o : ev.octave;
    const n = ev.n != null ? ev.n : ev.note;
    return midiToFreq(noteToMidi(o, n));
  }

  function ticksToSeconds(ticks) {
    return ticks * TICK_SECONDS;
  }

  /** Accept array [t,ch,n,o,v,d,w?] or object */
  function normalizeEvent(raw) {
    let t, ch, n, o, v, d, w;
    if (Array.isArray(raw)) {
      t = raw[0];
      ch = raw[1];
      n = raw[2];
      o = raw[3];
      v = raw[4];
      d = raw[5];
      w = raw[6];
    } else {
      t = raw.t != null ? raw.t : raw.startTime;
      ch = raw.ch != null ? raw.ch : raw.channel;
      n = raw.n != null ? raw.n : raw.note;
      o = raw.o != null ? raw.o : raw.octave;
      v = raw.v != null ? raw.v : raw.volume;
      d = raw.d != null ? raw.d : raw.duration;
      w = raw.w != null ? raw.w : raw.wave;
    }
    const wave = typeof w === "string" && w ? w.toLowerCase() : "square";
    const allowed = ["square", "sawtooth", "noise", "sine"];
    const waveType = allowed.includes(wave) ? wave : "square";
    return { t: +t, ch: +ch, n: +n, o: +o, v: +v, d: +d, w: waveType };
  }

  function validateEvent(ev) {
    const err = [];
    if (!Number.isFinite(ev.t) || ev.t < 0) err.push("start tick >= 0");
    if (!Number.isFinite(ev.d) || ev.d <= 0) err.push("duration > 0");
    if (!Number.isFinite(ev.v)) err.push("volume");
    if (!Number.isFinite(ev.n)) err.push("note");
    if (!Number.isFinite(ev.o)) err.push("octave");
    return err;
  }

  function songEndSeconds(events) {
    let max = 0;
    for (const raw of events) {
      const ev = normalizeEvent(raw);
      const end = ticksToSeconds(ev.t + ev.d);
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
    normalizeEvent,
    validateEvent,
    songEndSeconds,
  };
})(typeof window !== "undefined" ? window : globalThis);
