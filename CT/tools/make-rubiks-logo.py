"""Compose the printed center decal for the Stickers cube.

Source: the official Rubik's logo the user supplied, already cut out with a
genuine alpha channel (`Downloads/rubiks-logo.webp`). Nothing is redrawn here:
the mark is trimmed, the "RUBIKS.COM" line is set beneath it, and the pair is
placed on a canvas centred on the mark, so the renderer can pin the mark to the
center of the cap and let the wordmark hang below it.

The wordmark is the only thing drawn. The retail print is a heavy, tightly
tracked grotesque set close under the mark, so Arial Black is used, the cap
height is anchored to the mark's own height, and the tracking is solved for a
target width rather than guessed. The line is placed by its measured ink, not by
the font's ascender box, which keeps the gap visually tight. Output is a
transparent PNG for `setupCenterMark()` in cube-realistic.js.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\alejo\Downloads\rubiks-logo.webp")
OUTPUT = ROOT / "assets" / "rubiks-logo.png"
FONT = r"C:\Windows\Fonts\ariblk.ttf"
WORDMARK = "RUBIKS.COM"
CANVAS_WIDTH = 1024
MARK_WIDTH = 900
TEXT_CAP_RATIO = 0.21     # cap height as a fraction of the mark's height
TRACKING_EM = -0.02       # letter spacing, as a fraction of the point size
GAP_RATIO = 0.02          # visual space between the mark and the line
BOTTOM_MARGIN = 24        # transparent breathing room under the line
FILL = (0, 0, 0, 255)


def tracked_line(text, font, tracking):
    """Render `text` with per-character tracking, cropped to its actual ink."""
    probe = Image.new("RGBA", (1, 1))
    draw = ImageDraw.Draw(probe)
    width = sum(draw.textlength(character, font=font) for character in text) + tracking * (len(text) - 1)
    ascent, descent = font.getmetrics()
    pad = 8
    line = Image.new("RGBA", (int(width) + pad * 2, ascent + descent + pad * 2), (0, 0, 0, 0))
    pen = ImageDraw.Draw(line)
    x = pad
    for character in text:
        pen.text((x, pad), character, font=font, fill=FILL)
        x += draw.textlength(character, font=font) + tracking
    return line.crop(line.getbbox())


source = Image.open(SOURCE).convert("RGBA")
source = source.crop(source.getbbox())

mark_height = round(MARK_WIDTH * source.height / source.width)
source = source.resize((MARK_WIDTH, mark_height), Image.LANCZOS)

probe = Image.new("RGBA", (1, 1))
draw = ImageDraw.Draw(probe)
target_cap = TEXT_CAP_RATIO * mark_height
font = min(
    (ImageFont.truetype(FONT, size) for size in range(20, 220)),
    key=lambda candidate: abs(draw.textbbox((0, 0), "R", font=candidate)[3] - draw.textbbox((0, 0), "R", font=candidate)[1] - target_cap),
)
tracking = TRACKING_EM * font.size
line = tracked_line(WORDMARK, font, tracking)

gap = round(GAP_RATIO * mark_height)
# The canvas is centred on the mark, so the mark lands on the cap's center and
# the line simply hangs below it.
canvas_height = int(2 * (mark_height / 2 + gap + line.height) + 2 * BOTTOM_MARGIN)
canvas_height += canvas_height % 2
canvas = Image.new("RGBA", (CANVAS_WIDTH, canvas_height), (0, 0, 0, 0))
mark_y = (canvas_height - mark_height) // 2
canvas.alpha_composite(source, ((CANVAS_WIDTH - MARK_WIDTH) // 2, mark_y))
canvas.alpha_composite(line, ((CANVAS_WIDTH - line.width) // 2, mark_y + mark_height + gap))

canvas.save(OUTPUT)
print(f"{OUTPUT.name}: {canvas.size[0]}x{canvas.size[1]} (aspect {canvas.size[0] / canvas.size[1]:.4f}), "
      f"mark {MARK_WIDTH}x{mark_height}, line {line.width}px font {font.size}pt tracking {tracking:.1f}, gap {gap}")
