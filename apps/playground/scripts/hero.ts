// Regenerates src/assets/hero.jpg (2400×1000 gradient). Run: node apps/playground/scripts/hero.ts
import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="2400" height="1000" fill="url(#g)"/><circle cx="1800" cy="300" r="260" fill="#14b8a6" opacity=".35"/></svg>`;
await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(new URL("../src/assets/hero.jpg", import.meta.url).pathname);
