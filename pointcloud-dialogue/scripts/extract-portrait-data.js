// Converts portrait pixels to a compact binary-ish float array for inline embedding
// Format: [x0, y0, bri0, x1, y1, bri1, ...]  — 3 floats per particle
import { createCanvas, loadImage } from "canvas";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const IMG_PATH = join(__dirname, "..", "assets", "musk-ref.png");
  const OUT_PATH = join(__dirname, "..", "assets", "portrait-data.js");

  const img = await loadImage(IMG_PATH);
  const SRC_H = 900;
  const SRC_W = Math.round(img.width * (SRC_H / img.height));
  const canvas = createCanvas(SRC_W, SRC_H);
  const c = canvas.getContext("2d");

  c.fillStyle = "#000";
  c.fillRect(0, 0, SRC_W, SRC_H);
  const pad = SRC_H * 0.06;
  const dstH = SRC_H - pad * 2;
  const dstW = Math.min(SRC_W - pad * 2, Math.round(dstH * 0.75));
  c.drawImage(img, (SRC_W - dstW) / 2, pad, dstW, dstH);

  const id = c.getImageData(0, 0, SRC_W, SRC_H).data;
  const STEP = 2; // every 2 pixels → ~60k total (step=1 would be ~250k)
  const vals = [];

  for (let y = 0; y < SRC_H; y += STEP) {
    for (let x = 0; x < SRC_W; x += STEP) {
      const i = (y * SRC_W + x) * 4;
      const r = id[i], g = id[i+1], b = id[i+2], a = id[i+3];
      if (a < 180) continue;
      const bri = r*0.299 + g*0.587 + b*0.114;
      if (bri < 25) continue;
      vals.push(x / SRC_W, y / SRC_H, bri);
    }
  }

  // Generate JS: flat array of [nx, ny, bri, ...]
  // Store as string to avoid JSON overhead
  let arrStr = "";
  for (let i = 0; i < vals.length; i += 3) {
    arrStr += `${vals[i].toFixed(4)},${vals[i+1].toFixed(4)},${Math.round(vals[i+2])},`;
  }

  const count = vals.length / 3;
  const kbEst = Math.round(arrStr.length / 1024);

  const js = `// Musk portrait: ${count} pixels, ~${kbEst}KB
// [nx, ny, bri, ...] flat array
export const PORTRAIT_DATA = [${arrStr}];
export const PORTRAIT_COUNT = ${count};
`;

  writeFileSync(OUT_PATH, js);
  console.log(`Pixels: ${count} | Est size: ~${kbEst}KB | Array len: ${vals.length}`);
}

main().catch(console.error);
