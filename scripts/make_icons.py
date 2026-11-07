#!/usr/bin/env python3
"""Draws the app icons into public/icons. Needs Pillow. Only rerun to change the icon."""
import math
import os
import random

from PIL import Image, ImageDraw

BACKGROUND = (0x12, 0x26, 0x1f, 255)
TILE = (0x0b, 0x8a, 0x50, 255)
EDGE = (0x07, 0x64, 0x3a, 255)
WHITE = (255, 255, 255, 255)
DARK_SPECK = (0x06, 0x3d, 0x24, 140)
LIGHT_SPECK = (0x7f, 0xdc, 0xaa, 140)
PATTERNS = {3: [(0, 0), (1, 1), (2, 2)], 5: [(0, 0), (2, 0), (1, 1), (0, 2), (2, 2)]}
SUPERSAMPLE = 6
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')


def tile_layer(width, simple):
    """One upright 5:3 tile. Small sizes drop the specks, with bigger dots and a thicker line."""
    height = width * 2
    margin = round(width * 0.1)
    layer = Image.new('RGBA', (width + margin * 2, height + margin * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = (margin, margin, margin + width, margin + height)
    draw.rounded_rectangle(box, radius=width * 0.14, fill=TILE, outline=EDGE, width=round(width * 0.035))

    if not simple:
        rng = random.Random(7)
        specks = Image.new('RGBA', layer.size, (0, 0, 0, 0))
        speck_draw = ImageDraw.Draw(specks)
        for i in range(46):
            x = margin + width * (0.05 + rng.random() * 0.9)
            y = margin + height * (0.03 + rng.random() * 0.94)
            size = rng.random()
            r = width * (0.005 + size * size * 0.015)
            speck_draw.ellipse((x - r, y - r, x + r, y + r), fill=DARK_SPECK if i % 3 else LIGHT_SPECK)
        layer = Image.alpha_composite(layer, specks)
        draw = ImageDraw.Draw(layer)

    middle = margin + height / 2
    line = width * (0.07 if simple else 0.045)
    draw.rectangle((margin + width * 0.16, middle - line / 2, margin + width * 0.84, middle + line / 2), fill=WHITE)

    radius = width * (0.125 if simple else 0.095)
    step = width * (0.3 if simple else 0.26)
    pad = width / 2 - step
    for number, top in ((5, margin), (3, margin + height / 2)):
        for col, row in PATTERNS[number]:
            x = margin + pad + col * step
            y = top + pad + row * step
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=WHITE)
    return layer


def render(size, tile_share, simple=False, rounded=False):
    """tile_share is the tile's width as a share of the icon's."""
    big = size * SUPERSAMPLE
    canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=big * 0.22 if rounded else 0, fill=BACKGROUND
    )
    tile = tile_layer(round(big * tile_share), simple).rotate(22, expand=True, resample=Image.BICUBIC)
    canvas.alpha_composite(tile, ((big - tile.width) // 2, (big - tile.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def safe_share():
    """The widest tile whose corners stay in Android's safe circle, 40% of the icon from center."""
    half_diagonal = math.hypot(0.5, 1)
    return 0.4 / half_diagonal


os.makedirs(OUT, exist_ok=True)
outputs = {
    'icon-192.png': render(192, 0.36, rounded=True),
    'icon-512.png': render(512, 0.36, rounded=True),
    'maskable-192.png': render(192, safe_share()),
    'maskable-512.png': render(512, safe_share()),
    'apple-touch-icon.png': render(180, 0.36),
    'favicon-32.png': render(32, 0.38, simple=True, rounded=True),
    'favicon-16.png': render(16, 0.42, simple=True, rounded=True),
}
for name, image in outputs.items():
    image.save(os.path.join(OUT, name), optimize=True)
    print(name, image.size)
