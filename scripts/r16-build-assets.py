"""Rebuild R16 assets with Pillow, fonttools and Brotli (see review/round16/REPORT.md)."""
from PIL import Image
from fontTools import subset
Image.open('public/grain.png').save('public/grain.v2.webp', 'WEBP', quality=65, method=6)
Image.open('public/grain.png').save('public/grain.v1.avif', 'AVIF', quality=35, speed=4)
options = subset.Options()
options.flavor = 'woff2'
font = subset.load_font('public/fonts/archivo.v2.woff2', options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text='0123456789:')
subsetter.subset(font)
subset.save_font(font, 'public/fonts/archivo-clock.v1.woff2', options)
