"""Render the Rovo launch film from local project assets."""

from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent
W, H, FPS, DURATION = 1280, 720, 24, 21
BLACK = (0, 0, 0)
SURFACE = (25, 25, 25)
PANEL = (34, 34, 34)
WHITE = (255, 255, 255)
LIME = (204, 255, 0)
MUTED = (145, 145, 145)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
LOGO = Image.open(ROOT / "assets/brand/rovo-logo.png").convert("RGBA")


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def clamp(x):
    return max(0, min(1, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def label(d, xy, txt, size=25, fill=WHITE, bold=False):
    d.text(xy, txt, font=font(size, bold), fill=fill)


def logo(im, x, y, width):
    h = round(width * LOGO.height / LOGO.width)
    im.alpha_composite(LOGO.resize((width, h), Image.Resampling.LANCZOS), (x, y))


def cursor(d, x, y):
    d.polygon([(x, y), (x + 2, y + 26), (x + 8, y + 20), (x + 17, y + 34),
               (x + 23, y + 31), (x + 14, y + 17), (x + 24, y + 15)], fill=WHITE)
    d.line([(x, y), (x + 2, y + 26), (x + 8, y + 20), (x + 17, y + 34)], fill=BLACK, width=2)


def shell(im, step, title):
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((560, 83, 1200, 638), radius=26, fill=SURFACE, outline=(62, 62, 62), width=2)
    logo(im, 593, 104, 126)
    label(d, (595, 170), title, 31, WHITE, True)
    names = ["Identity", "Pair", "First Buy", "Review"]
    for i, name in enumerate(names):
        x = 594 + i * 145
        col = LIME if i == step else ((205, 205, 205) if i < step else (110, 110, 110))
        label(d, (x, 229), f"{i+1:02d} {name}", 16, col, i == step)
    d.line((594, 267, 1164, 267), fill=(58, 58, 58), width=2)


def scene1(t):
    im = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(im)
    logo(im, 70, 51, 176)
    arrival = ease((t - .12) / .48)
    y = int(192 + 28 * (1 - arrival))
    label(d, (70, y), "Put a person", 92, WHITE, True)
    label(d, (70, y + 105), "on the market.", 92, LIME, True)
    d.rounded_rectangle((72, 536, 72 + int(318 * ease((t - .55) / .7)), 543), radius=3, fill=LIME)
    label(d, (72, 566), "ROVO  /  PROFILE MARKETS", 21, MUTED, True)
    return im


def scene2(t):
    im = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(im)
    label(d, (72, 67), "01 / CHOOSE A PATH", 20, LIME, True)
    label(d, (72, 192), "Discover", 68, WHITE, True)
    label(d, (72, 269), "before they do.", 58, WHITE, True)
    label(d, (72, 392), "Self-Rove or Scout.", 27, MUTED)
    shell(im, 0, "Scout someone")
    d.rounded_rectangle((593, 294, 914, 351), radius=8, fill=(33, 33, 33))
    selected = t >= 1.9
    d.rounded_rectangle((598 if not selected else 756, 299, 752 if not selected else 908, 346), radius=6, fill=LIME)
    label(d, (619, 309), "Self-Rove", 23, BLACK if not selected else MUTED, True)
    label(d, (792, 309), "Scout", 23, BLACK if selected else MUTED, True)
    label(d, (593, 383), "Scout someone before they launch.", 23, WHITE, True)
    label(d, (593, 426), "Launch a public X profile market.", 19, MUTED)
    d.rounded_rectangle((593, 536, 1166, 594), radius=9, fill=LIME)
    label(d, (825, 551), "Continue", 23, BLACK, True)
    if 1.1 < t < 2.35:
        x = int(828 + 4 * math.sin(t * 5))
        cursor(d, x, 329)
    return im


def scene3(t):
    im = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(im)
    label(d, (72, 67), "02 / BUILD THE MARKET", 20, LIME, True)
    label(d, (72, 190), "A profile.", 70, WHITE, True)
    label(d, (72, 269), "A pair.", 70, LIME, True)
    label(d, (72, 395), "A market takes shape.", 27, MUTED)
    step = 0 if t < 2.5 else 1
    shell(im, step, "Launch a profile market")
    if t < 2.5:
        label(d, (593, 294), "Identity", 20, MUTED)
        d.rounded_rectangle((593, 336, 1166, 438), radius=13, fill=PANEL, outline=LIME, width=2)
        d.ellipse((612, 355, 676, 419), fill=(76, 84, 53))
        label(d, (632, 364), "A", 40, LIME, True)
        label(d, (694, 353), "Ada Vale", 27, WHITE, True)
        label(d, (694, 390), "@adavale  ·  Profile preview", 18, MUTED)
        label(d, (593, 471), "Fictional profile shown for demonstration", 16, MUTED)
    else:
        label(d, (593, 294), "Pair with", 20, WHITE)
        d.rounded_rectangle((593, 337, 866, 435), radius=13, fill=PANEL, outline=LIME, width=2)
        d.ellipse((612, 360, 665, 413), fill=(40, 80, 164))
        label(d, (625, 368), "$", 33, WHITE, True)
        label(d, (681, 350), "USDC", 27, WHITE, True)
        label(d, (681, 390), "Selected pair", 18, MUTED)
        d.rounded_rectangle((885, 337, 1166, 435), radius=13, fill=PANEL)
        label(d, (912, 355), "ETH", 26, WHITE, True)
        label(d, (912, 393), "Other asset", 18, MUTED)
        cursor(d, 839, 413)
    d.rounded_rectangle((593, 536, 1166, 594), radius=9, fill=LIME)
    label(d, (825, 551), "Continue", 23, BLACK, True)
    return im


def scene4(t):
    im = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(im)
    label(d, (72, 67), "03 / REVIEW", 20, LIME, True)
    label(d, (72, 195), "Ready to", 70, WHITE, True)
    label(d, (72, 274), "launch.", 70, LIME, True)
    label(d, (72, 401), "Your market, your call.", 27, MUTED)
    shell(im, 3, "Review launch")
    rows = [("Profile", "Ada Vale  ·  @adavale"), ("Pair", "USDC"), ("First buy", "Skipped")]
    for i, (a, b) in enumerate(rows):
        y = 302 + i * 64
        d.rounded_rectangle((593, y, 1166, y + 54), radius=10, fill=PANEL)
        label(d, (612, y + 14), a, 18, MUTED)
        label(d, (822, y + 12), b, 19, WHITE, True)
    d.rounded_rectangle((593, 536, 1166, 594), radius=9, fill=LIME)
    label(d, (846, 551), "Launch", 23, BLACK, True)
    if t > 2.2:
        cursor(d, 1026, 584)
    label(d, (598, 612), "Preview only · no transaction shown", 15, MUTED)
    return im


def scene5(t):
    im = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((73, 170, 86, 534), radius=6, fill=LIME)
    logo(im, 127, 176, 310)
    label(d, (127, 339), "Make a market", 64, WHITE, True)
    label(d, (127, 414), "around a profile.", 64, WHITE, True)
    label(d, (130, 544), "rovo.fun", 25, LIME, True)
    return im


SCENES = [(0, 3, scene1), (3, 7, scene2), (7, 12, scene3), (12, 17, scene4), (17, 21, scene5)]


def frame(t):
    for i, (start, end, render) in enumerate(SCENES):
        if t < end or i == len(SCENES) - 1:
            current = render(t - start)
            if i and t < start + .28:
                previous = SCENES[i - 1][2](start - SCENES[i - 1][0])
                current = Image.blend(previous, current, ease((t - start) / .28))
            return current.convert("RGB")
    raise AssertionError(t)


def main():
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
           "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags",
           "+faststart", str(OUT / "brag.silent.mp4")]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for n in range(FPS * DURATION):
            proc.stdin.write(frame(n / FPS).tobytes())
    finally:
        proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg render failed")


if __name__ == "__main__":
    main()
