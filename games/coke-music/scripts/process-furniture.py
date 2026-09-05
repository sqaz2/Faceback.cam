#!/usr/bin/env python3
"""Chroma-key magenta furniture stills via edge flood-fill + hue key; trim to transparent PNG."""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = {
    "sofa": "13a13936-e107-440e-bf25-7c54305e98a6.jpg",
    "chair": "5dca4b19-82f7-4ca6-bc22-fc5c3c918b44.jpg",
    "table": "97ef402d-5dce-4839-9a9e-5fa7bbaa44c0.jpg",
    "lamp": "2fcaa0e2-c86b-4440-9fc2-0df3f8adc30e.jpg",
    "plant": "09e70509-f0a6-4fea-90af-74e4e7bbb97d.jpg",
    "speaker": "dccecb27-8e61-4841-9a08-03fec9775573.jpg",
    "bean": "9d4ac078-72b4-481f-b466-dba4f205710c.jpg",
    "fridge": "efede53c-8be1-483e-a172-cce2b6897890.jpg",
    "vending": "253ae4de-ed12-421f-95dc-9aa840e4d4d9.jpg",
    "jukebox": "0db4143f-2175-43d9-8bd6-ee5756354221.jpg",
    "disco": "621c6f1f-fe14-44ff-82bd-d69be49683c4.jpg",
    "stool": "60e498bc-defb-4705-a197-6f4a6211ac3e.jpg",
    "mic": "e0d26413-fec2-4623-97f8-591779426d6a.jpg",
    "crate": "cb6c38ac-0b74-480a-910c-23a7ccd04cf8.jpg",
    "booth": "1ee653c8-7116-4438-b3e3-61c1d57a035c.jpg",
    "stage": "9927d480-ea6c-4d1b-b7e4-25f498e66b8e.jpg",
    "tv": "2bb350ff-5b4b-42fa-8b57-d8043263d016.jpg",
}

SRC = Path("/workspace/artifacts/imagine_images")
DST = Path("/workspace/public/art/furniture")
MAX_SIZE = 400


def magenta_like(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    return (r > 140) & (b > 120) & (g + 30 < r) & (g + 20 < b) & (((r + b) * 0.5 - g) > 40)


def chroma(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mag = magenta_like(r, g, b)
    dist_ff = np.sqrt((r - 255.0) ** 2 + (g - 0.0) ** 2 + (b - 255.0) ** 2)
    bg = np.median(
        np.stack(
            [
                arr[4, 4, :3],
                arr[4, w - 5, :3],
                arr[h - 5, 4, :3],
                arr[h - 5, w - 5, :3],
            ]
        ),
        axis=0,
    )
    dist_bg = np.linalg.norm(arr[:, :, :3] - bg, axis=2)
    is_red = (r > 100) & (b < 100) & (g < 110) & (r > b + 55)
    backdrop = (mag | (dist_ff < 120) | (dist_bg < 58)) & (~is_red)

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
            if ny < 0 or nx < 0 or ny >= h or nx >= w or visited[ny, nx]:
                continue
            if backdrop[ny, nx]:
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
    fringe = (~grow) & (visited | mag | (dist_ff < 140))
    alpha = np.where(fringe, np.clip((dist_ff - 80) / 70.0, 0, 1) * 255.0, alpha)

    spill = np.clip(np.minimum(r, b) - g, 0, 80)
    arr[:, :, 0] = arr[:, :, 0] - spill * 0.22
    arr[:, :, 2] = arr[:, :, 2] - spill * 0.55
    arr[:, :, 3] = alpha
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def process_one(name: str, fname: str) -> None:
    src = SRC / fname
    im = chroma(Image.open(src))
    im = trim(im)
    im.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
    out = DST / f"{name}.png"
    im.save(out, "PNG", optimize=True)
    opaque = np.array(im)[:, :, 3]
    ratio = float((opaque > 10).mean())
    print(f"{name:10} {im.size} opaque={ratio:.2f} {out.stat().st_size // 1024}KB")


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    for name, fname in ASSETS.items():
        process_one(name, fname)


if __name__ == "__main__":
    main()
