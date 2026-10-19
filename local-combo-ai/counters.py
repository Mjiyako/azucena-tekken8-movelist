"""Independent local OCR of current combo counters, never historical maxima."""
import io
import re
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageOps


def executable():
    found = shutil.which('tesseract')
    fallback = Path('C:/Program Files/Tesseract-OCR/tesseract.exe')
    return found or (str(fallback) if fallback.exists() else None)


def parse(text):
    damage, hits = None, None
    for line in text.splitlines():
        if re.search(r'max|recover|health', line, re.I):
            continue
        match = re.search(r'\b(\d{1,3})\s+(?:Total\s+)?Damage\b|\b(?:Total\s+)?Damage\s*[:=]?\s*(\d{1,3})\b', line, re.I)
        if match:
            value = int(match[1] or match[2])
            if 0 < value <= 500:
                damage = value
        match = re.search(r'\b(\d{1,2})\s*Hits?(?:\s*Combo)?\b', line, re.I)
        if match:
            hits = int(match[1]) or None
    return damage, hits


def read(frame):
    tool = executable()
    if not tool:
        return {'available': False, 'damage': None, 'hits': None, 'text': [], 'disagreement': False}
    with Image.open(frame) as image:
        w, h = image.size
        counter = image.crop((0, int(h * .18), int(w * .36), int(h * .65)))
        gray = ImageOps.autocontrast(ImageOps.grayscale(counter)).resize((counter.width*2, counter.height*2))
        variants = [gray, gray.point(lambda p: 255 if p > 185 else 0)]
        texts = []
        for variant in variants:
            buffer = io.BytesIO()
            variant.save(buffer, format='PNG')
            result = subprocess.run([tool,'stdin','stdout','-l','eng','--psm','6'],
                input=buffer.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30, check=True)
            texts.append(result.stdout.decode('utf-8', errors='replace'))
    readings = [parse(text) for text in texts]
    damages = {damage for damage, _ in readings if damage is not None}
    hits = {hit for _, hit in readings if hit is not None}
    return {'available': True, 'damage': next(iter(damages)) if len(damages) == 1 else None,
            'hits': next(iter(hits)) if len(hits) == 1 else None,
            'text': texts, 'disagreement': len(damages) > 1 or len(hits) > 1}
