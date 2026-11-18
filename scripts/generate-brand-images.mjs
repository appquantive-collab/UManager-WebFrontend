// Builds every PNG the app needs from public/logo.svg: favicons, install
// icons (incl. maskable), and the iPhone/iPad launch screens with the name.
// Run after changing the logo or name:  node scripts/generate-brand-images.mjs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "..", "public");
const NAME = "VoiceMunshi";
const TAGLINE = "Bol ke hisaab, Munshi ke saath";
const BG = "#fbf9f5";

const logo = await readFile(path.join(pub, "logo.svg"));

// Plain icons.
for (const size of [32, 64, 192, 512]) {
  await sharp(logo, { density: 384 }).resize(size, size).png().toFile(path.join(pub, `logo-${size}.png`));
}
await sharp(logo, { density: 384 }).resize(512, 512).png().toFile(path.join(pub, "logo.png"));

// Maskable: full-bleed orange so Android's circle/squircle crop never shows a white corner.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0662c"/><stop offset="1" stop-color="#a53400"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#bg)"/>
  </svg>`
);
const inner = await sharp(logo, { density: 384 }).resize(360, 360).png().toBuffer();
await sharp(maskable).composite([{ input: inner, gravity: "centre" }]).png().toFile(path.join(pub, "logo-maskable-512.png"));

// Launch screens: same sizes as the files already there.
const splashDir = path.join(pub, "splash");
for (const file of (await readdir(splashDir)).filter((f) => f.endsWith(".png"))) {
  const { width, height } = await sharp(path.join(splashDir, file)).metadata();
  const icon = Math.round(width * 0.26);
  const nameSize = Math.round(width * 0.075);
  const tagSize = Math.round(width * 0.036);
  const textY = Math.round(height / 2 + icon / 2 + nameSize * 1.6);
  const page = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${BG}"/>
      <text x="50%" y="${textY}" text-anchor="middle" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-weight="800" font-size="${nameSize}" fill="#2b1a10">${NAME}</text>
      <text x="50%" y="${textY + Math.round(tagSize * 1.9)}" text-anchor="middle" font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-weight="500" font-size="${tagSize}" fill="#7a6658">${TAGLINE}</text>
    </svg>`
  );
  const iconPng = await sharp(logo, { density: 384 }).resize(icon, icon).png().toBuffer();
  await sharp(page)
    .composite([{ input: iconPng, top: Math.round(height / 2 - icon / 2 - nameSize), left: Math.round(width / 2 - icon / 2) }])
    .png()
    .toFile(path.join(splashDir, file));
  console.log("splash", file, `${width}x${height}`);
}
console.log("icons done");
