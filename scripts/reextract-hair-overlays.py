#!/usr/bin/env python3
"""Re-extract Tail/Bangs (and optional styles) hair overlays from cyan master sheets.

Masters are 4x4 (actions x dirs) on green screen with cyan hair.
Outputs 4-dir strips at 1280x308 matching the runtime wardrobe sheets.
Brand-safe: only recolors/slices existing master pixels — no drawn cubes.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / "art-source/faceback/avatar/generated-masters"
OUT_PUBLIC = ROOT / "public/coke-music/art/avatar/generated/hair"
OUT_NESTED = ROOT / "coke-music/public/art/avatar/generated/hair"
ACTIONS = ["idle", "walk", "sit", "dance"]
# Focus styles called out as remaining risks; also refresh flow/crop for consistency.
STYLES = ["tail", "bangs", "flow", "crop", "spikes", "halo"]
BODIES = ["man", "woman"]
STRIP_W, STRIP_H = 1280, 308


def green_mask(arr: np.ndarray) -> np.ndarray:
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    return (g > 160) & (g > r + 35) & (g > b + 35)


def cyan_hair_mask(arr: np.ndarray) -> np.ndarray:
    """Keep saturated cyan/teal hair; exclude green screen and warm skin."""
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    green = green_mask(arr)
    # Primary cyan (bright key color on masters)
    cyan = (g > 75) & (b > 75) & (g > r + 18) & (b > r + 10) & (((g + b) / 2 - r) > 32)
    # Shadowed teal strands (still blue-green dominant)
    teal = (b > 50) & (g > 40) & (b + g > 2.15 * r + 15) & ((r + g + b) / 3 > 42) & (b > r + 5) & (g > r)
    peach = (r > 90) & (g > 50) & (b > 30) & (r > g * 1.05) & (g > b * 1.02) & (r - b > 25)
    return (cyan | teal) & ~green & ~peach


def keep_head_components(mask: np.ndarray, cell_h: int, style: str) -> np.ndarray:
    """Drop body-leak blobs; keep components that touch the scalp band."""
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    keep = np.zeros_like(mask, dtype=bool)
    # Tail hangs lower; bangs stay near crown
    head_frac = 0.72 if style == "tail" else 0.50 if style == "flow" else 0.52
    max_frac = 0.45 if style in ("tail", "flow") else 0.32
    head_y = int(cell_h * head_frac)
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue
            q = deque([(y, x)])
            visited[y, x] = True
            cells: list[tuple[int, int]] = [(y, x)]
            touches_head = y < head_y
            while q:
                cy, cx = q.popleft()
                if cy < head_y:
                    touches_head = True
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
            if touches_head and (len(cells) / (h * w)) <= max_frac:
                for cy, cx in cells:
                    keep[cy, cx] = True
    return keep


def dilate(mask: np.ndarray, times: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(times):
        nxt = out.copy()
        nxt[1:, :] |= out[:-1, :]
        nxt[:-1, :] |= out[1:, :]
        nxt[:, 1:] |= out[:, :-1]
        nxt[:, :-1] |= out[:, 1:]
        out = nxt
    return out


def extract_style(body: str, style: str) -> None:
    master = np.array(Image.open(MASTERS / f"{body}-{style}.png").convert("RGBA"))
    hair = cyan_hair_mask(master)
    # One-pixel dilate then re-gate to cyan-ish neighbors to close strand gaps without body leak
    grown = dilate(hair, 1) & ~green_mask(master)
    r, g, b = master[:, :, 0].astype(np.float32), master[:, :, 1].astype(np.float32), master[:, :, 2].astype(np.float32)
    near = (g > 55) & (b > 55) & (g + b > 1.8 * r)
    hair = hair | (grown & near)

    h, w = master.shape[:2]
    cell_h, cell_w = h // 4, w // 4
    for row, action in enumerate(ACTIONS):
        strip = np.zeros((cell_h, cell_w * 4, 4), dtype=np.uint8)
        for col in range(4):
            y0, x0 = row * cell_h, col * cell_w
            cell = master[y0 : y0 + cell_h, x0 : x0 + cell_w]
            mask = keep_head_components(hair[y0 : y0 + cell_h, x0 : x0 + cell_w], cell_h, style)
            out = np.zeros_like(cell)
            out[mask] = cell[mask]
            out[:, :, 3] = np.where(mask, 255, 0).astype(np.uint8)
            # Soften hard edges slightly via alpha falloff on boundary
            edge = mask & ~dilate(mask, 0)
            # simple: reduce alpha on pixels with <2 opaque neighbors
            for yy in range(1, cell_h - 1):
                for xx in range(1, cell_w - 1):
                    if not mask[yy, xx]:
                        continue
                    n = int(mask[yy - 1, xx]) + int(mask[yy + 1, xx]) + int(mask[yy, xx - 1]) + int(mask[yy, xx + 1])
                    if n <= 1:
                        out[yy, xx, 3] = 140
                    elif n == 2:
                        out[yy, xx, 3] = 200
            strip[:, col * cell_w : (col + 1) * cell_w] = out
        im = Image.fromarray(strip, "RGBA").resize((STRIP_W, STRIP_H), Image.Resampling.LANCZOS)
        for dest_root in (OUT_PUBLIC, OUT_NESTED):
            dest = dest_root / body / style
            dest.mkdir(parents=True, exist_ok=True)
            path = dest / f"{action}.png"
            im.save(path, "PNG", optimize=True)
        opaque = float((np.array(im)[:, :, 3] > 10).mean())
        print(f"{body}/{style}/{action}: opaque={opaque:.4f}")


def main() -> None:
    for body in BODIES:
        for style in STYLES:
            extract_style(body, style)


if __name__ == "__main__":
    main()
