#!/usr/bin/env python3
"""Chroma-key avatar sprite sheets. Keep even cell grids (do not trim)."""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SHEETS = {
    "idle": "4e33fd38-4f44-4577-a0fe-9cdc16ff2dd8.jpg",
    "walk": "e1f8daf3-db73-4593-92db-c20b5ea2428a.jpg",
    "sit": "714649f0-dd10-4cc6-989e-8d422293618b.jpg",
    "dance": "1e22b6e9-c327-4e16-a88a-9ba0ed9a3d73.jpg",
}

SRC = Path("/workspace/artifacts/imagine_images")
DST = Path("/workspace/public/art/avatar")
MAX = 1024


def magenta_like(r, g, b):
    return (r > 140) & (b > 120) & (g + 30 < r) & (g + 20 < b) & (((r + b) * 0.5 - g) > 40)


def chroma(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mag = magenta_like(r, g, b)
    dist_ff = np.sqrt((r - 255.0) ** 2 + (g - 0.0) ** 2 + (b - 255.0) ** 2)
    bg = np.median(
        np.stack([arr[4, 4, :3], arr[4, w - 5, :3], arr[h - 5, 4, :3], arr[h - 5, w - 5, :3]]),
        axis=0,
    )
    dist_bg = np.linalg.norm(arr[:, :, :3] - bg, axis=2)
    is_red = (r > 100) & (b < 100) & (g < 110) & (r > b + 55)
    backdrop = (mag | (dist_ff < 130) | (dist_bg < 52)) & (~is_red)

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if backdrop[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if backdrop[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and backdrop[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    grow = visited.copy()
    nxt = grow.copy()
    nxt[1:, :] |= grow[:-1, :]
    nxt[:-1, :] |= grow[1:, :]
    nxt[:, 1:] |= grow[:, :-1]
    nxt[:, :-1] |= grow[:, 1:]
    grow = nxt & ~is_red
    alpha = np.where(grow, 0.0, 255.0)
    spill = np.clip(np.minimum(r, b) - g, 0, 90)
    arr[:, :, 0] = arr[:, :, 0] - spill * 0.28
    arr[:, :, 2] = arr[:, :, 2] - spill * 0.62
    arr[:, :, 3] = alpha
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    for name, fname in SHEETS.items():
        im = chroma(Image.open(SRC / fname))
        im.thumbnail((MAX, MAX), Image.Resampling.LANCZOS)
        out = DST / f"{name}.png"
        im.save(out, "PNG", optimize=True)
        opaque = float((np.array(im)[:, :, 3] > 10).mean())
        print(f"{name:8} {im.size} opaque={opaque:.2f} {out.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
