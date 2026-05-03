#!/usr/bin/env python3
"""
Reads `GameSong.java` SONG_DATA and renders:
  - 50% duty square-wave mix (instruction-style approximation)
  - WAV + waveform / spectrogram PNGs under site/assets/

MIDI convention (aligned with GAMESONGS.txt comments): C4=midi60 via
    midi = 12 * (octave + 1) + note
Rest: note >= 12 or volume == 0.
"""
from __future__ import annotations

import argparse
import math
import re
import warnings
import wave
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

TICK_SECONDS = 0.06
ROW_PATTERN = re.compile(
    r"\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}"
)


def load_events(java_path: Path) -> tuple[list[tuple[int, int, int, int, int, int]], str]:
    text = java_path.read_text(encoding="utf-8")
    if "SONG_DATA" not in text:
        raise SystemExit(f"No SONG_DATA in {java_path}")
    events: list[tuple[int, int, int, int, int, int]] = []
    for m in ROW_PATTERN.finditer(text):
        a, b, c, d, e, f = (int(g) for g in m.groups())
        events.append((a, b, c, d, e, f))
    if not events:
        raise SystemExit(f"No event rows matched in {java_path}")
    return events, text


def midi_frequency(midi_note: float) -> float:
    return 440.0 * math.pow(2.0, (midi_note - 69.0) / 12.0)


def event_midi(note: int, octave: int) -> float | None:
    if note >= 12:
        return None
    return 12.0 * float(octave + 1) + float(note)


def render(events: list[tuple[int, int, int, int, int, int]], fs: int) -> np.ndarray:
    if not events:
        return np.zeros(0, dtype=np.float64)
    max_tick = max(s + d for (s, _ch, _n, _o, _v, d) in events)
    n_samples = max(1, int(math.ceil(max_tick * TICK_SECONDS * fs)))
    y = np.zeros(n_samples, dtype=np.float64)

    phases: dict[int, float] = {}

    # Per tick, rebuild active notes (discrete semantics: change at tick boundary)
    for tick in range(max_tick):
        active: dict[int, tuple[float, float]] = {}

        # All events that cover this tick
        for start, channel, note, octave, volume, duration in events:
            if start <= tick < start + duration and volume > 0:
                midi = event_midi(note, octave)
                if midi is not None:
                    f = midi_frequency(midi)
                    amp = volume / 12.0
                    active[channel] = (f, amp)

        t0_i = int(math.ceil(tick * TICK_SECONDS * fs))
        t1_i = int(math.ceil((tick + 1) * TICK_SECONDS * fs))
        t1_i = min(t1_i, n_samples)
        if t0_i >= t1_i:
            continue

        for ch, (f_hz, amp) in active.items():
            if ch not in phases:
                phases[ch] = 0.0
            phase = phases[ch]

            rng = slice(t0_i, t1_i)
            length = rng.stop - rng.start
            dphi = (2 * math.pi * f_hz / fs)
            samp = phase + dphi * np.arange(length, dtype=np.float64)
            square = np.sign(np.sin(samp)).astype(np.float64)
            y[rng] += amp * square
            if length:
                phases[ch] = (float(samp[-1]) + dphi) % (2 * math.pi)

    peak = np.max(np.abs(y)) if y.size else 0.0
    if peak > 0:
        target = 0.98
        y = (y / peak) * target
    int16_max = np.iinfo(np.int16).max
    return np.clip(y * int16_max, -int16_max, int16_max).astype(np.int16)


def write_wav(path: Path, samples: np.ndarray, fs: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(fs)
        w.writeframes(samples.tobytes())


def plot_wave_detail(path: Path, raw: np.ndarray, fs: int, window_sec: float) -> None:
    n = max(2, min(raw.size, int(window_sec * fs)))
    xs = np.arange(n) / fs
    ys = raw[:n] / np.iinfo(np.int16).max
    fig, ax = plt.subplots(figsize=(8, 2.8), constrained_layout=True)
    ax.plot(xs, ys, color="#214a73", lw=0.8)
    ax.set_xlim(0, xs[-1])
    ax.set_ylim(-1.05, 1.05)
    ax.set_title("Waveform (detail, square approx.)")
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Normalized amplitude")
    fig.savefig(path, dpi=144)
    plt.close(fig)


def plot_wave_full(path: Path, raw: np.ndarray, fs: int) -> None:
    ys = raw.astype(np.float64) / np.iinfo(np.int16).max
    xs = np.arange(raw.size) / fs
    fig, ax = plt.subplots(figsize=(9, 2.4), constrained_layout=True)
    ax.plot(xs, ys, color="#5c3d7a", lw=0.6)
    ax.set_xlim(0, xs[-1] if xs.size else 1)
    ax.set_title("Waveform (full length)")
    ax.set_xlabel("Time (s)")
    ax.set_yticks([])
    fig.savefig(path, dpi=144)
    plt.close(fig)


def plot_spectrogram(path: Path, raw: np.ndarray, fs: int) -> None:
    f = raw.astype(np.float64) / np.iinfo(np.int16).max
    fig, ax = plt.subplots(figsize=(8, 3.2), constrained_layout=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        ax.specgram(f, Fs=fs, cmap="magma", NFFT=1024)
    ax.set_title("Spectrogram (matplotlib)")
    ax.set_ylabel("Frequency (Hz)")
    ax.set_xlabel("Time (s)")
    fig.savefig(path, dpi=144)
    plt.close(fig)


def pcm_size_bytes(rate: int, channels: int, bits: int, duration_s: float) -> int:
    return int(rate * channels * (bits // 8) * duration_s)


def main() -> None:
    ap = argparse.ArgumentParser(description="Export WAV + PNGs from GameSong.java")
    ap.add_argument(
        "--java",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "GameSong.java",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "site" / "assets",
        help="Output directory",
    )
    ap.add_argument("--fs", type=int, default=44100)
    args = ap.parse_args()

    events, _ = load_events(args.java)
    samples = render(events, args.fs)
    out = args.out_dir
    wav_path = out / "gamesong.wav"
    write_wav(wav_path, samples, args.fs)
    dur = samples.size / args.fs if samples.size else 0.0
    pcm16 = pcm_size_bytes(args.fs, 1, 16, dur)

    event_bytes = sum(6 * 4 for _ in events)  # six int32-ish rows (Java primitive int)
    comparison_path = out / "compression_note.txt"

    comparison_path.parent.mkdir(parents=True, exist_ok=True)
    comparison_path.write_text(
        "\n".join(
            [
                f"Duration_s_approx: {dur:.6f}",
                f"PCM_16_mono_bytes: {pcm16}",
                f"Event_rows: {len(events)}",
                f"Rough_event_table_bytes(Java int[6][]): {event_bytes}",
                f"Reduction_factor_PCM_over_events: {pcm16 / event_bytes:.2f}x (PCM larger)",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    f32 = samples.astype(np.float64) / np.iinfo(np.int16).max
    plot_wave_full(out / "waveform_full.png", samples, args.fs)
    plot_wave_detail(out / "waveform_detail.png", samples, args.fs, window_sec=min(0.25, dur or 0.25))
    plot_spectrogram(out / "spectrogram.png", samples, args.fs)

    print(f"Wrote {wav_path} ({dur:.3f}s, {pcm16} bytes PCM equiv)")
    print(f"Saved plots and {comparison_path}")


if __name__ == "__main__":
    main()
