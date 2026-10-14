"""Makes the app icons for Corporate Luck by Chance (run once: python tools/make-icons.py).
A teal square with an ivory dice: ivory face, five black dots, turned a little, with a soft shadow.
The maskable icons keep the dice inside the middle 80 percent circle, so any round or rounded mask on a phone leaves it whole."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public")
TEAL, IVORY, EDGE = "#0B5D5B", "#FFFDF9", "#D9E4E2"
PIPS = [(0.27, 0.27, "#151515"), (0.73, 0.27, "#151515"), (0.27, 0.73, "#151515"), (0.73, 0.73, "#151515"), (0.5, 0.5, "#151515")]
SS = 4  # draw at four times the size, then shrink: smooth edges


def dice(side):
    """the dice face as a transparent picture, `side` pixels wide"""
    im = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(side * 0.2)
    d.rounded_rectangle([0, 0, side - 1, side - 1], r, fill=EDGE)
    d.rounded_rectangle([int(side * 0.02), int(side * 0.02), side - 1 - int(side * 0.02), side - 1 - int(side * 0.05)], r, fill=IVORY)
    pr = side * 0.105
    for x, y, c in PIPS:
        cx, cy = x * side, y * side * 0.97
        d.ellipse([cx - pr, cy - pr + pr * 0.08, cx + pr, cy + pr + pr * 0.08], fill="#00000030")
        d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=c)
        d.ellipse([cx - pr * 0.55, cy - pr * 0.6, cx - pr * 0.1, cy - pr * 0.2], fill="#FFFFFF55")
    return im


def mk(size, frac):
    n = size * SS
    bg = Image.new("RGBA", (n, n), TEAL)
    side = int(n * frac)
    die = dice(side).rotate(-10, resample=Image.BICUBIC, expand=True)
    x, y = (n - die.width) // 2, (n - die.height) // 2
    shadow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sh = Image.new("RGBA", die.size, (0, 0, 0, 0))
    sh.putalpha(die.getchannel("A").point(lambda a: int(a * 0.38)))
    shadow.paste(sh, (x + int(n * 0.012), y + int(n * 0.03)), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(n * 0.015))
    bg = Image.alpha_composite(bg, shadow)
    bg.paste(die, (x, y), die)
    return bg.convert("RGB").resize((size, size), Image.LANCZOS)


for name, size, frac in [("icon-192.png", 192, 0.56), ("icon-512.png", 512, 0.56), ("icon-maskable-192.png", 192, 0.46), ("icon-maskable-512.png", 512, 0.46), ("apple-touch-icon.png", 180, 0.58)]:
    mk(size, frac).save(os.path.join(OUT, name), optimize=True)
    print("wrote", name)
