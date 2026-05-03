#!/usr/bin/env python3
"""Generate qr-site.png linking to --url (HTTPS recommended for static hosting)."""

from __future__ import annotations

import argparse
from pathlib import Path

import segno


def main() -> None:
    ap = argparse.ArgumentParser(description="PNG QR pointing to deployed site URL")
    ap.add_argument("--url", required=True, help="Landing URL")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("site/assets/qr-site.png"),
        help="PNG output path relative to repo root",
    )
    args = ap.parse_args()
    root = Path(__file__).resolve().parent.parent
    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    q = segno.make(args.url, error="m")
    q.save(str(out), scale=12, dark="#111827", light="#ffffffff", kind="png")
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
