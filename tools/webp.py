"""Create a .webp twin for every .jpg in src/img (and src/img/refs). Run after adding photos:
    python3 tools/webp.py
Needs Pillow (pip install pillow). The site uses the .webp when it exists and keeps the .jpg as fallback."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent / "src" / "img"
made = 0
for jpg in sorted(root.rglob("*.jpg")):
    if "-plan" in jpg.stem:
        continue  # floor plans stay JPG (opened full size in a new tab)
    webp = jpg.with_suffix(".webp")
    if webp.exists() and webp.stat().st_mtime >= jpg.stat().st_mtime:
        continue
    Image.open(jpg).convert("RGB").save(webp, "WEBP", quality=78, method=6)
    made += 1
print(f"{made} WebP file(s) written")
