// Generates portrait-data.js — assigns portrait array to window.__PORTRAIT_DATA__
// Loaded via <script src="assets/portrait-data.js"> — HyperFrames bundles it inline
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
  const STEP = 2;
  const vals = [];

  for (let y = 0; y < SRC_H; y += STEP) {
    for (let x = 0; x < SRC_W; x += STEP) {
      const i = (y * SRC_W + x) * 4;
      const r = id[i], g = id[i+1], b = id[i+2], a = id[i+3];
      if (a < 180) continue;
      const bri = r*0.299 + g*0.587 + b*0.114;
      if (bri < 25) continue;
      vals.push([+(x/SRC_W).toFixed(4), +(y/SRC_H).toFixed(4), bri|0]);
    }
  }

  const count = vals.length;

  // Write as a compact JS global
  // Format: window.__PORTRAIT_DATA__ = [[nx,ny,bri], [nx,ny,bri], ...]
  // Use eval-friendly string format for minimal size
  let arrStr = vals.map(v => `[${v[0]},${v[1]},${v[2]}]`).join(",");

  const js = `// Musk portrait: ${count} pixels, ~${Math.round(arrStr.length/1024)}KB
window.__PORTRAIT_DATA__ = [${arrStr}];
window.__PORTRAIT_COUNT__ = ${count};
`;

  writeFileSync(OUT_PATH, js);
  const kb = Math.round(Buffer.byteLength(js) / 1024);
  console.log(`Pixels: ${count} | File size: ~${kb}KB`);
}

main().catch(console.error);
