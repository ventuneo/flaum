#!/usr/bin/env python3
"""Renders the app icon: the aura with its white centre. Needs Pillow.

Usage: make-icons.py <assets folder>
"""
import math
import os
import sys

from PIL import Image


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def blob(px, py, cx, cy, rx, ry):
    d = math.hypot((px - cx) / rx, (py - cy) / ry)
    t = max(0.0, 1.0 - d)
    return t * t * (3 - 2 * t)


def render(size):
    img = Image.new('RGB', (size, size))
    data = img.load()
    base = (252, 214, 192)
    layers = [
        ((253, 231, 168), 0.15, 0.2, 0.75, 0.7),
        ((251, 189, 184), 1.0, 0.45, 0.75, 0.75),
        ((251, 205, 176), 0.2, 0.95, 0.9, 0.7),
        ((255, 255, 255), 0.5, 0.5, 0.34, 0.34),
    ]
    for y in range(size):
        for x in range(size):
            px, py = x / size, y / size
            colour = base
            for tint, cx, cy, rx, ry in layers:
                colour = lerp(colour, tint, blob(px, py, cx, cy, rx, ry))
            data[x, y] = tuple(int(round(c)) for c in colour)
    return img


def main(folder):
    master = render(512)
    for size in (180, 192, 512):
        out = master if size == 512 else master.resize((size, size), Image.LANCZOS)
        out.save(os.path.join(folder, f'icon-{size}.png'), optimize=True)


if __name__ == '__main__':
    main(sys.argv[1])
