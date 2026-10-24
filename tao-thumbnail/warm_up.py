"""Warm up the lighting and make the figure pop in a finished thumbnail.

Usage: python3 warm_up.py IN.jpg OUT.jpg
Cuts the figure out of IN, grades figure and background separately, and
recombines them with a warm key light, rim light and vignette.
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
    # skin/hair midtones (not the near-white shirt) get a golden tan
    mid = np.clip(1 - np.abs(lum - 0.5) / 0.4, 0, 1)
    rgb = rgb + mid * np.array([0.055, 0.02, -0.04])
    rgb = saturate(rgb, 1.25)
    # bring the white shirt down to a warm cream so it isn't blown out
    hi = np.clip((lum - 0.75) / 0.25, 0, 1)
    rgb = rgb * (1 - hi * 0.08) + hi * 0.08 * np.array([0.96, 0.88, 0.74])
    # richer shadows: deeper eyes, hair and beard texture
    rgb = s_curve(rgb, 0.22)
    rgb = rgb * np.array([1.03, 1.0, 0.94])
    return rgb


def grade_background(rgb):
    rgb = rgb * np.array([1.06, 1.0, 0.86]) + np.array([0.015, 0.005, 0.0])
    rgb = saturate(rgb, 1.08)
    return s_curve(rgb, 0.08)


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
    bg = grade_background(rgb)

    # warm halo behind the figure so it separates from the card/painting
    soft = np.asarray(to_img(a[..., 0], "L").filter(ImageFilter.GaussianBlur(45)))
    halo = (soft.astype(np.float32) / 255.0)[..., None] * 0.18
    bg = bg * (1 - halo) + np.array([1.0, 0.86, 0.62]) * halo

    # shape the shirt: falloff toward the bottom and the left (away from the key)
    yy, xx = np.mgrid[0:h, 0:w]
    form = np.clip((yy / h - 0.6) / 0.4, 0, 1) * 0.16 + np.clip(0.5 - xx / w, 0, 1) * 0.22
    lum = (fig @ LUMA)[..., None]
    fig = fig * (1 - form[..., None] * np.clip((lum - 0.6) / 0.3, 0, 1))

    out = bg * (1 - a) + fig * a

    # golden key light from upper right, falling across the face
    key = radial(h, w, w * 0.78, h * 0.48, w * 0.95) ** 2
    out = out + key * np.array([0.09, 0.05, 0.0]) * (0.12 + 0.88 * a)

    # warm rim on the figure's edge
    edge = a - (to_arr(to_img(a[..., 0], "L").filter(ImageFilter.MinFilter(9))))[..., None]
    edge = np.asarray(to_img(np.clip(edge, 0, 1)[..., 0], "L").filter(ImageFilter.GaussianBlur(4)))
    edge = (edge.astype(np.float32) / 255.0)[..., None]
    out = out + edge * np.array([0.06, 0.04, 0.01])

    # soft warm-brown vignette to focus the frame
    vig = 1 - radial(h, w, w * 0.55, h * 0.5, max(w, h) * 0.75) ** 0.6
    out = out * (1 - vig * 0.35) + vig * 0.35 * np.array([0.22, 0.15, 0.07]) * out * 2

    to_img(out).save(dst, quality=95)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
