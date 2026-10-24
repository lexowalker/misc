"""Three more layouts of the portrait-over-cover thumbnail, one per portrait.

Usage: python3 variants.py   (reads src/, writes out/thumbnail-*.jpg)
"""
import os

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from make_thumbnail import H, W, cut_out, glow

CACHE = "build"


def cached_cut(name):
    path = os.path.join(CACHE, f"cut-{name}.png")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        cut_out(Image.open(f"src/portrait-{name}.jpg").convert("RGB")).save(path)
    fig = Image.open(path).convert("RGBA")
    return fig.crop(fig.getchannel("A").getbbox())


def cover():
    return Image.open("src/cover.jpg").convert("RGB").resize((W, H), Image.LANCZOS)


def arr(im):
    return np.asarray(im).astype(np.float32) / 255.0


def img(a, mode):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), mode)


def place(fig, width=None, height=None):
    s = width / fig.width if width else height / fig.height
    return fig.resize((round(fig.width * s), round(fig.height * s)), Image.LANCZOS)


def layer(fig, x, y):
    """Put fig on a full-frame transparent canvas (clipping anything outside)."""
    canvas = Image.new("RGBA", (W, H))
    canvas.alpha_composite(fig, (max(x, 0), max(y, 0)),
                           (max(-x, 0), max(-y, 0)))
    return canvas


def warm_light(size, cx, cy, radius, color, strength):
    """Radial light pool, returned as an RGBA overlay."""
    yy, xx = np.mgrid[0:size[1], 0:size[0]]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    a = np.clip(1 - d, 0, 1) ** 2 * strength
    over = np.zeros((size[1], size[0], 4), np.float32)
    over[..., :3] = np.array(color) / 255.0
    over[..., 3] = a
    return img(over, "RGBA")


def bottom_fade(color=(30, 26, 14), start=0.78, amount=0.45):
    g = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    v = np.clip((g - start) / (1 - start), 0, 1) ** 1.5 * amount
    out = Image.new("RGBA", (W, H), color + (0,))
    out.putalpha(img(v, "L"))
    return out


# --- A: indoor smile, big and golden, over the lower half of the card -------

def golden(fig):
    a = arr(fig)
    rgb = a[..., :3]
    rgb = rgb * np.array([1.04, 1.01, 0.88]) + np.array([0.03, 0.02, 0.0])
    # tame the cool tint in the glasses and the white shirt's blue cast
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    rgb = rgb * 0.88 + lum[..., None] * np.array([1.04, 1.0, 0.9]) * 0.12
    rgb = rgb + 0.10 * (rgb - 0.5) * (1 - np.abs(2 * np.clip(rgb, 0, 1) - 1))
    a[..., :3] = rgb
    return img(a, "RGBA")


def version_a():
    bg = cover().convert("RGBA")
    # warm the whole cover slightly toward candlelight
    bg.alpha_composite(warm_light((W, H), 820, 1150, 1100, (255, 200, 120), 0.28))
    fig = place(golden(cached_cut("indoor")), width=1240)
    x, y = (W - fig.width) // 2 - 10, H - fig.height + 40
    fl = layer(fig, x, y)
    halo = glow(fl.getchannel("A"), (255, 226, 170), 70, 1.4)
    bg.alpha_composite(halo)
    bg.alpha_composite(glow(fl.getchannel("A"), (35, 25, 10), 22, 0.5), (-10, 8))
    bg.alpha_composite(fl)
    # rim of warm light on the figure from the right
    rim = warm_light((W, H), 1000, 1050, 700, (255, 210, 140), 0.35)
    rim.putalpha(Image.fromarray(np.minimum(np.asarray(rim.getchannel("A")),
                                            np.asarray(fl.getchannel("A")))))
    bg.alpha_composite(rim)
    bg.alpha_composite(bottom_fade(start=0.85, amount=0.3))
    return bg.convert("RGB")


# --- B: outdoor close-up, bleeding off the right, toned to the cover --------

def cover_tone(fig, amount):
    """Blend the figure toward a split tone in the cover's olive/cream palette."""
    a = arr(fig)
    rgb = a[..., :3]
    lum = (rgb @ np.array([0.299, 0.587, 0.114]))[..., None]
    shadow = np.array([0.16, 0.17, 0.10])
    light = np.array([1.0, 0.95, 0.80])
    toned = shadow + (light - shadow) * lum
    rgb = rgb * (1 - amount) + toned * amount
    rgb = rgb * np.array([1.05, 1.0, 0.92])
    rgb = rgb + 0.14 * (rgb - 0.5) * (1 - np.abs(2 * np.clip(rgb, 0, 1) - 1))
    a[..., :3] = rgb
    return img(a, "RGBA")


def version_b():
    bg = cover()
    # nudge the card up so the face can take the lower 60%
    shifted = Image.new("RGB", (W, H))
    shifted.paste(bg.crop((0, 260, W, H)), (0, 0))
    shifted.paste(bg.crop((0, H - 260, W, H)).transpose(Image.FLIP_TOP_BOTTOM),
                  (0, H - 260))
    bg = shifted.convert("RGBA")

    fig = place(cover_tone(cached_cut("outdoor"), 0.35), width=1320)
    x, y = W - fig.width + 230, H - fig.height + 200
    fl = layer(fig, x, y)
    bg.alpha_composite(glow(fl.getchannel("A"), (255, 228, 170), 45, 1.0))
    bg.alpha_composite(glow(fl.getchannel("A"), (30, 25, 10), 30, 0.55), (-18, 0))
    bg.alpha_composite(fl)
    # golden backlight on the hair, like the original late sun
    sun = warm_light((W, H), 760, 900, 520, (255, 205, 120), 0.45)
    sun.putalpha(Image.fromarray(np.minimum(np.asarray(sun.getchannel("A")),
                                            np.asarray(fl.getchannel("A")))))
    bg.alpha_composite(sun)
    bg.alpha_composite(bottom_fade(start=0.8, amount=0.4))
    return bg.convert("RGB")


# --- C: B&W portrait printed into the painting like ink ---------------------

def version_c():
    """The face sits on a cream mist, then multiplies in like brush ink."""
    bg = cover().convert("RGBA")
    fig = place(cached_cut("bw"), height=1260)
    fl = layer(fig, 40, H - fig.height + 110)
    bg.alpha_composite(glow(fl.getchannel("A"), (246, 238, 214), 70, 1.5))
    base = arr(bg.convert("RGB"))
    gray = ImageEnhance.Contrast(ImageOps.grayscale(fl.convert("RGB"))).enhance(1.35)
    ink_color = np.array([0.20, 0.17, 0.12])
    ink = ink_color + (1 - ink_color) * arr(gray)[..., None]
    a = arr(fl.getchannel("A"))[..., None]
    base = base * (1 - a) + base * ink * a
    rng = np.random.default_rng(7)
    base = base + rng.normal(0, 0.03, (H, W))[..., None]
    return img(base, "RGB").filter(ImageFilter.GaussianBlur(0.4))


if __name__ == "__main__":
    os.makedirs("out", exist_ok=True)
    version_a().save("out/thumbnail-indoor.jpg", quality=94)
    version_b().save("out/thumbnail-outdoor.jpg", quality=94)
    version_c().save("out/thumbnail-ink.jpg", quality=94)
