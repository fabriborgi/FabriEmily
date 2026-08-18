// Una volta sola, in sviluppo: sharp non finisce nel bundle.
// npm i -D sharp && node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
for (const [size, name] of [
  [192, 'public/icon-192.png'],
  [512, 'public/icon-512.png'],
  [180, 'public/apple-touch-icon.png'],
]) {
  await sharp(svg).resize(size, size).png().toFile(name);
  console.log('scritto', name);
}
