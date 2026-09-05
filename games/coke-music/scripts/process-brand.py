#!/usr/bin/env python3
"""Normalize splash / OG / X-banner and bake the Coke Music lockup in code."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SPLASH_SRC = "/workspace/artifacts/imagine_images/9944c543-9062-43a2-ac22-236489188b85.jpg"
OG_SRC = "/workspace/artifacts/imagine_images/d0b3bafe-b40a-4ff6-9b5f-6c494d413d38.jpg"
BANNER_SRC = "/workspace/artifacts/imagine_images/0d250586-8bf1-4285-a56b-0cd4ee6c1729.jpg"


def cover(im: Image.Image, w: int, h: int) -> Image.Image:
    im = im.convert("RGB")
    scale = max(w / im.width, h / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def text_size(font: ImageFont.FreeTypeFont, text: str) -> tuple[int, int]:
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_lockup(
    im: Image.Image,
    *,
    x: int,
    y: int,
    coke_size: int,
    music_size: int,
    tag: str | None,
    tag_size: int,
    align: str = "center",
) -> None:
    draw = ImageDraw.Draw(im)
    coke_font = ImageFont.truetype(BOLD, coke_size)
    music_font = ImageFont.truetype(REG, music_size)
    coke_w, coke_h = text_size(coke_font, "Coke")
    music_w, music_h = text_size(music_font, "Music")
    gap = int(coke_size * 0.18)
    total_w = coke_w + gap + music_w
    if align == "center":
        left = x - total_w // 2
    else:
        left = x
    # Shadow pass
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    cream = (255, 248, 242, 255)
    coke_col = (255, 248, 242, 255)
    music_col = (244, 232, 220, 230)
    baseline = y
    sd.text((left + 3, baseline + 4), "Coke", font=coke_font, fill=(20, 8, 10, 180))
    sd.text((left + coke_w + gap + 3, baseline + 4), "Music", font=music_font, fill=(20, 8, 10, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    im.paste(Image.alpha_composite(im.convert("RGBA"), shadow).convert("RGB"))
    draw = ImageDraw.Draw(im)
    draw.text((left, baseline), "Coke", font=coke_font, fill=coke_col[:3])
    draw.text((left + coke_w + gap, baseline), "Music", font=music_font, fill=music_col[:3])
    if tag:
        tag_font = ImageFont.truetype(REG, tag_size)
        tw, th = text_size(tag_font, tag)
        tx = left if align == "left" else x - tw // 2
        ty = baseline + max(coke_h, music_h) + int(tag_size * 0.55)
        draw.text((tx + 2, ty + 2), tag, font=tag_font, fill=(20, 8, 10))
        draw.text((tx, ty), tag, font=tag_font, fill=(230, 213, 196))


def darken_band(im: Image.Image, y0: float, y1: float, strength: float) -> Image.Image:
    overlay = Image.new("RGB", im.size, (20, 8, 10))
    mask = Image.new("L", im.size, 0)
    md = ImageDraw.Draw(mask)
    h = im.height
    top = int(h * y0)
    bot = int(h * y1)
    for i in range(top, bot):
        t = (i - top) / max(1, bot - top)
        # peak in the middle of the band
        a = int(255 * strength * (1 - abs(t - 0.45) * 1.6))
        a = max(0, min(220, a))
        md.line([(0, i), (im.width, i)], fill=a)
    return Image.composite(overlay, im, mask)


def main() -> None:
    splash = cover(Image.open(SPLASH_SRC), 1792, 1008)
    splash.save("/workspace/public/art/splash.jpg", "JPEG", quality=88, optimize=True)
    print("splash", splash.size, Path("/workspace/public/art/splash.jpg").stat().st_size // 1024, "KB")

    og = cover(Image.open(OG_SRC), 1200, 630)
    og = darken_band(og, 0.18, 0.62, 0.55)
    draw_lockup(
        og,
        x=600,
        y=175,
        coke_size=86,
        music_size=78,
        tag="Mix. Hang. Burn a disc.",
        tag_size=26,
        align="center",
    )
    og.save("/workspace/public/og.jpg", "JPEG", quality=88, optimize=True)
    print("og", og.size, Path("/workspace/public/og.jpg").stat().st_size // 1024, "KB")

    banner = cover(Image.open(BANNER_SRC), 1200, 264)
    banner = darken_band(banner, 0.0, 0.85, 0.5)
    draw_lockup(
        banner,
        x=48,
        y=38,
        coke_size=54,
        music_size=48,
        tag="Studios open",
        tag_size=18,
        align="left",
    )
    banner.save("/workspace/public/x-banner.jpg", "JPEG", quality=88, optimize=True)
    print("banner", banner.size, Path("/workspace/public/x-banner.jpg").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
