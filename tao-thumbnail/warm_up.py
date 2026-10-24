"""Warm up the figure in a finished thumbnail, leaving the cover untouched.

Usage: python3 warm_up.py IN.jpg OUT.jpg
Cuts the figure out of IN, grades only the figure (warm skin, contrast, a
golden key light and a shaded shirt) and puts it back over IN's own
background pixels, which are left exactly as they were.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

LUMA = np.array([0.299, 0.587, 0.114])


def to_arr(im):
    return np.asarray(im).astype(np.float32) / 255.0


def to_img(a, mode="RGB"):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), mode)


def figure_alpha(im, cache):
    if os.path.exists(cache):
        cut = Image.open(cache)
    else:
        cut = remove(im, session=new_session("birefnet-portrait"))
        os.makedirs(os.path.dirname(cache) or ".", exist_ok=True)
        cut.save(cache)
    return to_arr(cut.getchannel("A"))[..., None]


def s_curve(rgb, k):
    return rgb + k * (rgb - 0.5) * (1 - np.abs(2 * np.clip(rgb, 0, 1) - 1))


def saturate(rgb, k):
    lum = (rgb @ LUMA)[..., None]
    return lum + (rgb - lum) * k


def grade_figure(rgb):
    lum = (rgb @ LUMA)[..., None]
    # warm only where there's already skin colour (r > b), so silver hair and
    # beard stay neutral; lean rosy (red) rather than yellow (low blue)
    skin = np.clip((rgb[..., :1] - rgb[..., 2:]) / 0.12, 0, 1)
    mid = np.clip(1 - np.abs(lum - 0.5) / 0.4, 0, 1)
    rgb = rgb + skin * mid * np.array([0.055, 0.018, -0.008])
    rgb = saturate(rgb, 1.16)
    # bring the white shirt down to a soft off-white so it isn't blown out
    hi = np.clip((lum - 0.75) / 0.25, 0, 1)
    rgb = rgb * (1 - hi * 0.06) + hi * 0.06 * np.array([0.95, 0.92, 0.87])
    # richer shadows: deeper eyes, hair and beard texture
    rgb = s_curve(rgb, 0.22)
    return rgb * np.array([1.015, 1.0, 0.985])


def radial(h, w, cx, cy, r):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    return np.clip(1 - d, 0, 1)[..., None]


def main(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    rgb = to_arr(im)
    a = figure_alpha(im, os.path.join("build", "cut-" + os.path.basename(src) + ".png"))

    fig = grade_figure(rgb)

    # shape the shirt: falloff toward the bottom and the left (away from the key)
    yy, xx = np.mgrid[0:h, 0:w]
    form = np.clip((yy / h - 0.6) / 0.4, 0, 1) * 0.16 + np.clip(0.5 - xx / w, 0, 1) * 0.22
    lum = (fig @ LUMA)[..., None]
    fig = fig * (1 - form[..., None] * np.clip((lum - 0.6) / 0.3, 0, 1))

    # soft warm key light from upper right, falling across the face
    key = radial(h, w, w * 0.78, h * 0.48, w * 0.95) ** 2
    fig = fig + key * np.array([0.05, 0.035, 0.02])

    # warm rim just inside the figure's edge
    inner = to_arr(to_img(a[..., 0], "L").filter(ImageFilter.MinFilter(9)))[..., None]
    edge = to_img(np.clip(a - inner, 0, 1)[..., 0], "L").filter(ImageFilter.GaussianBlur(4))
    fig = fig + to_arr(edge)[..., None] * np.array([0.04, 0.03, 0.02])

    # only the figure changes; the background is the input, untouched
    out = rgb * (1 - a) + np.clip(fig, 0, 1) * a

    to_img(out).save(dst, quality=95)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
