"""Rebuild the compact shared coastline mask from the existing texture.
Optional tooling dependency: Pillow. No Python or image decoder runs in-game.
"""
from pathlib import Path
import json
from PIL import Image
root = Path(__file__).resolve().parent.parent
image = Image.open(root / "public/textures/solar-system/earth_specular_2048.jpg").convert("L").resize((128, 64), Image.Resampling.BOX)
rows = []
for y in range(65):
    row = [255 - image.getpixel((x, min(y, 63))) for x in range(128)]
    if y in [0, 64]:
        row = [round(sum(row) / len(row))] * 128
    rows.append("".join(f"{v:02x}" for v in row))
(root / "lib/earthLandMask.js").write_text(
    "// Derived from public/textures/solar-system/earth_specular_2048.jpg.\n"
    "// 128 longitude cells, 65 latitude rows; hex bytes measure land coverage.\n"
    + "export const EARTH_LAND_MASK = " + json.dumps(rows, indent=2) + ";\n"
)
