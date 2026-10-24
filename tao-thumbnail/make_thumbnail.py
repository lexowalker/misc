"""Composite a portrait over The Essential Tao cover as a 1080x1920 thumbnail.

Usage: python3 make_thumbnail.py COVER.jpg PORTRAIT.jpg OUT.jpg
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

W, H = 1080, 1920
COVER_SHIFT = 230      # move the title card up to make room for the figure
FIGURE_TOP = 1010      # y of the top of the head in the output


def extend_cover(cover):
    """Shift the cover up and fill the bottom with a mirrored strip."""
    cover = cover.convert("RGB").resize((W, H), Image.LANCZOS)
    out = Image.new("RGB", (W, H))
    out.paste(cover.crop((0, COVER_SHIFT, W, H)), (0, 0))
    strip = cover.crop((0, H - COVER_SHIFT, W, H)).transpose(Image.FLIP_TOP_BOTTOM)
    out.paste(strip, (0, H - COVER_SHIFT))
    return out


def cut_out(portrait):
    rgba = remove(portrait, session=new_session("birefnet-portrait"))
    return rgba.crop(rgba.getchannel("A").getbbox())


def grade(fig):
    """Warm, soft grade that sits the figure into the sepia cover."""
    a = np.asarray(fig).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    # gentle warm shift + lift shadows
    rgb = rgb * np.array([1.08, 1.01, 0.88]) + 0.035
    # pull the bright blue shirt toward the cover's muted palette
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    blueness = np.clip((rgb[..., 2] - rgb[..., 0]) * 3, 0, 1)[..., None]
    muted = lum[..., None] * np.array([1.0, 1.02, 0.98]) * 0.55 + rgb * 0.45
    rgb = rgb * (1 - 0.7 * blueness) + muted * 0.7 * blueness
    # soft s-curve for a little authority/contrast
    rgb = np.clip(rgb, 0, 1)
    rgb = rgb + 0.12 * (rgb - 0.5) * (1 - np.abs(2 * rgb - 1))
    out = np.concatenate([np.clip(rgb, 0, 1), alpha], axis=-1)
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def glow(alpha, color, radius, strength):
    a = alpha.filter(ImageFilter.GaussianBlur(radius))
    a = a.point(lambda v: min(255, int(v * strength)))
    layer = Image.new("RGBA", alpha.size, color + (0,))
    layer.putalpha(a)
    return layer


def main(cover_path, portrait_path, out_path):
    bg = extend_cover(Image.open(cover_path)).convert("RGBA")
    fig = grade(cut_out(Image.open(portrait_path).convert("RGB")))

    scale = (H - FIGURE_TOP) / fig.height
    fig = fig.resize((round(fig.width * scale), H - FIGURE_TOP), Image.LANCZOS)
    x = (W - fig.width) // 2 + 20

    # warm halo behind the figure, then a soft drop shadow
    pad = 120
    alpha = Image.new("L", (W + 2 * pad, H + 2 * pad))
    alpha.paste(fig.getchannel("A"), (x + pad, FIGURE_TOP + pad))
    halo = glow(alpha, (255, 236, 196), 60, 1.6).crop((pad, pad, pad + W, pad + H))
    shadow = glow(alpha, (40, 32, 18), 26, 0.45)
    shadow = shadow.crop((pad - 14, pad - 6, pad - 14 + W, pad - 6 + H))
    bg.alpha_composite(halo)
    bg.alpha_composite(shadow)
    bg.alpha_composite(fig, (x, FIGURE_TOP))

    # gentle bottom vignette so the figure grounds into the frame
    grad = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    v = np.clip((grad - 0.82) / 0.18, 0, 1) ** 1.5 * 0.35
    vig = Image.new("RGBA", (W, H), (30, 26, 14, 0))
    vig.putalpha(Image.fromarray((v * 255).astype(np.uint8)))
    bg.alpha_composite(vig)

    bg.convert("RGB").save(out_path, quality=94)


if __name__ == "__main__":
    main(*sys.argv[1:4])
