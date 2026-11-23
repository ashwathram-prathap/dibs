"""Rebuild R16 assets with Pillow, fonttools and Brotli (see review/round16/REPORT.md)."""
from PIL import Image
Image.open('public/grain.png').save('public/grain.v2.webp', 'WEBP', quality=65, method=6)
Image.open('public/grain.png').save('public/grain.v1.avif', 'AVIF', quality=35, speed=4)
# R18: the clock now uses the same Archivo font as display text.
