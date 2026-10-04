// Turn the rendered DTAM sheet pages into one WebP per posture: public/postures/<id>.webp
// Source PNGs (rendered at 2000 px wide) live outside the repo: <sources>/the<sheet>/p<page>.png
// Run: node scripts/make-sheet-images.mjs ../research/content/sources
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const sources = path.resolve(root, process.argv[2] ?? "../research/content/sources");
const postures = JSON.parse(readFileSync(path.join(root, "content", "postures.json"), "utf8"));
const out = path.join(root, "public", "postures");
mkdirSync(out, { recursive: true });

for (const p of postures) {
  const src = path.join(sources, `the${p.source.sheet}`, `p${p.source.page}.png`);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  const dest = path.join(out, `${p.id}.webp`);
  const info = await sharp(src).resize({ width: 1100 }).webp({ quality: 72 }).toFile(dest);
  console.log(`${p.id}.webp ${Math.round(info.size / 1024)} KB`);
}
