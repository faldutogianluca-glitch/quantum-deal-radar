"""Convert PNG slides/images to JPG cropped to exactly 1080x1350 (4:5).

Instagram rejects images taller than 4:5 (1080x1351 fails) and its API,
like TikTok photo posts, expects JPEG. LinkedIn can keep the PNGs.
Usage: python3 to_social_jpg.py SRC_DIR_OR_FILE... --out OUT_DIR
"""
import argparse, os, glob
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src', nargs='+')
ap.add_argument('--out', required=True)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
files = []
for s in a.src:
    files += sorted(glob.glob(os.path.join(s, '*.png'))) if os.path.isdir(s) else [s]
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    target_h = round(w * 5 / 4)
    if h > target_h:
        im = im.crop((0, 0, w, target_h))
    im = im.resize((1080, 1350))
    dst = os.path.join(a.out, os.path.basename(f).rsplit('.', 1)[0] + '.jpg')
    im.save(dst, quality=92)
    print(dst)
