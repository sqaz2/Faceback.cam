#!/usr/bin/env python3
"""Re-extract Cap/Shades/Headphones overlays from red accessory masters.

Masters are 4x4 (actions x dirs) on green screen with red accessories.
Outputs 4-dir strips at 1280x308 matching runtime wardrobe sheets.
Brand-safe: only recolors/slices existing master pixels — no drawn cubes.
Keeps head-band components so shades/headphones sit cleanly without body leak.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTERS = ROOT / "art-source/faceback/avatar/generated-masters"
OUT_PUBLIC = ROOT / "public/coke-music/art/avatar/generated/accessory"
OUT_NESTED = ROOT / "coke-music/public/art/avatar/generated/accessory"
ACTIONS = ["idle", "walk", "sit", "dance"]
STYLES = ["cap", "shades", "headphones"]
BODIES = ["man", "woman"]
STRIP_W, STRIP_H = 1280, 308


def green_mask(arr: np.ndarray) -> np.ndarray:
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    return (g > 160) & (g > r + 35) & (g > b + 35)


def peach_mask(arr: np.ndarray) -> np.ndarray:
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    return (r > 90) & (g > 50) & (b > 30) & (r > g * 1.05) & (g > b * 1.02) & (r - b > 25) & ((r + g + b) / 3 > 70)


def gray_clothes(arr: np.ndarray) -> np.ndarray:
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    lum = (r + g + b) / 3
    return (np.abs(r - g) < 28) & (np.abs(g - b) < 28) & (np.abs(r - b) < 28) & (lum > 25) & (lum < 200)


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


def red_accessory(arr: np.ndarray, style: str) -> np.ndarray:
    r, g, b = arr[:, :, 0].astype(np.float32), arr[:, :, 1].astype(np.float32), arr[:, :, 2].astype(np.float32)
    green = green_mask(arr)
    peach = peach_mask(arr)
    gray = gray_clothes(arr)
    red = (r > 120) & (r > g + 38) & (r > b + 32) & ((r - (g + b) / 2) > 42)
    maroon = (r > 75) & (r > g + 22) & (r > b + 20) & ((r - (g + b) / 2) > 25) & (r > g * 1.28)
    if style == "shades":
        lenses = (r > 50) & (r > g + 8) & (r > b + 5) & ((r + g + b) / 3 < 155) & ((r - (g + b) / 2) > 12)
        acc = (red | maroon | lenses) & ~green & ~peach & ~gray
    elif style == "headphones":
        gloss = (r > 175) & (g > 140) & (b > 140) & (r > g + 8) & (r > b + 8) & ((r - (g + b) / 2) > 10)
        acc = (red | maroon | gloss) & ~green & ~peach & ~gray
    else:
        acc = (red | maroon) & ~green & ~peach & ~gray
    return acc


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    comps: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue
            q = deque([(y, x)])
            visited[y, x] = True
            cells: list[tuple[int, int]] = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
            comps.append(cells)
    return comps


def keep_accessory(mask: np.ndarray, cell_h: int, style: str) -> np.ndarray:
    """Keep the main accessory mass in the upper head band; drop body strays."""
    # Upper fraction that can contain accessories (dance lifts the head).
    band = 0.28 if style == "shades" else 0.48 if style == "headphones" else 0.42
    y_cut = int(cell_h * band)
    clipped = mask.copy()
    clipped[y_cut:, :] = False
    comps = components(clipped)
    if not comps:
        return np.zeros_like(mask)

    scored: list[tuple[float, list[tuple[int, int]]]] = []
    for cells in comps:
        n = len(cells)
        min_n = 8 if style == "shades" else 12
        if n < min_n:
            continue
        ys = [c[0] for c in cells]
        xs = [c[1] for c in cells]
        hspan = max(ys) - min(ys) + 1
        wspan = max(xs) - min(xs) + 1
        # Reject tall thin body-outline streaks.
        if hspan > cell_h * 0.22 and hspan > wspan * 1.6:
            continue
        cy = sum(ys) / n
        # Prefer wide headgear / eyewear near the crown/eyes.
        wide_bonus = 1.25 if wspan >= hspan else 0.75
        crown_bonus = 1.3 if cy < cell_h * 0.18 else 1.0 if cy < cell_h * 0.22 else 0.7
        scored.append((n * wide_bonus * crown_bonus, cells))

    scored.sort(reverse=True, key=lambda t: t[0])
    keep = np.zeros_like(mask)
    max_keep = 1 if style in ("shades", "cap") else 2
    kept_cells: list[list[tuple[int, int]]] = []
    for _, cells in scored:
        if len(kept_cells) >= max_keep:
            break
        ys = [c[0] for c in cells]
        cy = sum(ys) / len(cells)
        # Drop late body speckles far below the crown/eye band.
        if cy > cell_h * (0.22 if style == "shades" else 0.36 if style == "cap" else 0.38):
            continue
        kept_cells.append(cells)
        for yy, xx in cells:
            keep[yy, xx] = True

    # Shades: absorb tiny nearby fragments inside the main bbox (lens gaps).
    if style == "shades" and scored:
        main = scored[0][1]
        mys = [c[0] for c in main]
        mxs = [c[1] for c in main]
        y0, y1, x0, x1 = min(mys) - 2, max(mys) + 2, min(mxs) - 4, max(mxs) + 4
        for _, cells in scored[1:6]:
            if len(cells) > 40:
                continue
            if all(y0 <= cy <= y1 and x0 <= cx <= x1 for cy, cx in cells):
                for cy, cx in cells:
                    keep[cy, cx] = True
    return keep


def extract_style(body: str, style: str) -> None:
    master = np.array(Image.open(MASTERS / f"{body}-{style}.png").convert("RGBA"))
    acc = red_accessory(master, style)
    dil_n = 2 if style == "shades" else 1
    grown = dilate(acc, dil_n) & ~green_mask(master) & ~peach_mask(master)
    r, g, b = master[:, :, 0].astype(np.float32), master[:, :, 1].astype(np.float32), master[:, :, 2].astype(np.float32)
    near = (r > g + 12) & (r > b + 10) & (r > 60)
    if style == "headphones":
        near = near | ((r > 165) & (g > 125) & (b > 125) & (r > g))
    if style == "shades":
        near = near | ((r > g + 5) & (r > b) & (r > 45) & ((r + g + b) / 3 < 160))
    acc = acc | (grown & near)

    h, w = master.shape[:2]
    cell_h, cell_w = h // 4, w // 4
    for row, action in enumerate(ACTIONS):
        strip = np.zeros((cell_h, cell_w * 4, 4), dtype=np.uint8)
        for col in range(4):
            y0, x0 = row * cell_h, col * cell_w
            cell = master[y0 : y0 + cell_h, x0 : x0 + cell_w]
            mask = keep_accessory(acc[y0 : y0 + cell_h, x0 : x0 + cell_w], cell_h, style)
            out = np.zeros_like(cell)
            out[mask] = cell[mask]
            out[:, :, 3] = np.where(mask, 255, 0).astype(np.uint8)
            for yy in range(1, cell_h - 1):
                for xx in range(1, cell_w - 1):
                    if not mask[yy, xx]:
                        continue
                    n = (
                        int(mask[yy - 1, xx])
                        + int(mask[yy + 1, xx])
                        + int(mask[yy, xx - 1])
                        + int(mask[yy, xx + 1])
                    )
                    if n <= 1:
                        out[yy, xx, 3] = 145
                    elif n == 2:
                        out[yy, xx, 3] = 205
            strip[:, col * cell_w : (col + 1) * cell_w] = out
        im = Image.fromarray(strip, "RGBA").resize((STRIP_W, STRIP_H), Image.Resampling.LANCZOS)
        for dest_root in (OUT_PUBLIC, OUT_NESTED):
            dest = dest_root / body / style
            dest.mkdir(parents=True, exist_ok=True)
            im.save(dest / f"{action}.png", "PNG", optimize=True)
        opaque = float((np.array(im)[:, :, 3] > 10).mean())
        print(f"{body}/{style}/{action}: opaque={opaque:.5f}")


def main() -> None:
    for body in BODIES:
        for style in STYLES:
            extract_style(body, style)


if __name__ == "__main__":
    main()
