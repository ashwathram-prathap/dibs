// Re-encode the unchanged museum scan for delivery; keep the source JPEG intact.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b=await chromium.launch();
try { const p=await b.newPage();await p.goto(pathToFileURL(resolve('public/art/animals-plate.jpg')).href);
 const data=await p.evaluate(async()=>{const image=document.images[0];await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d')!.drawImage(image,0,0);return canvas.toDataURL('image/webp',.9).split(',')[1];});
 writeFileSync('public/art/animals-plate.webp',Buffer.from(data,'base64'));
}finally{await b.close();}
