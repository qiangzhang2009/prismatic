// Pixel extraction from Musk reference photo
// Runs in Node.js with canvas package
import { createCanvas, loadImage } from "canvas";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const IMG_PATH = join(__dirname, "..", "assets", "musk-ref.png");
  const OUT_PATH = join(__dirname, "..", "assets", "musk-portrait.js");

  const img = await loadImage(IMG_PATH);
  console.log(`Image: ${img.width}x${img.height}`);

  // Draw at 1000px height to get high resolution data
  const SRC_H = 1000;
  const SRC_W = Math.round(img.width * (SRC_H / img.height));
  const canvas = createCanvas(SRC_W, SRC_H);
  const c = canvas.getContext("2d");

  // Black background first
  c.fillStyle = "#000";
  c.fillRect(0, 0, SRC_W, SRC_H);

  // Center the portrait with some padding
  const pad = SRC_H * 0.08;
  const dstH = SRC_H - pad * 2;
  const dstW = Math.min(SRC_W - pad * 2, Math.round(dstH * 0.75));
  const dstX = (SRC_W - dstW) / 2;
  const dstY = pad;
  c.drawImage(img, dstX, dstY, dstW, dstH);

  // Now extract pixels — adaptive threshold based on local neighborhood
  const id = c.getImageData(0, 0, SRC_W, SRC_H).data;
  const src = Uint8ClampedArray.from(id);

  // Compute grayscale + edge detection in one pass
  // We'll sample every N pixels for manageable count
  const STEP = 2; // step=1 for ~500k would be too many, step=2 gives ~250k
  const pts = [];

  // Pre-compute a brightness map
  const bright = new Float32Array(SRC_W * SRC_H);
  for (let i = 0; i < SRC_W * SRC_H; i++) {
    const r = src[i*4], g = src[i*4+1], b = src[i*4+2], a = src[i*4+3];
    bright[i] = a > 180 ? (r*0.299 + g*0.587 + b*0.114) : 0;
  }

  // Adaptive threshold: keep pixels that are brighter than their neighbors + margin
  for (let y = STEP; y < SRC_H - STEP; y += STEP) {
    for (let x = STEP; x < SRC_W - STEP; x += STEP) {
      const idx = y * SRC_W + x;
      const v = bright[idx];
      if (v < 30) continue; // skip very dark pixels

      // Check local neighborhood (3x3 average)
      let localSum = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ni = (y+dy)*SRC_W+(x+dx);
          if (ni >= 0 && ni < bright.length) {
            localSum += bright[ni];
            count++;
          }
        }
      }
      const localAvg = localSum / count;
      const contrast = v - localAvg;

      // Keep if bright enough AND has contrast (edge/detail pixels)
      if (contrast > 5 || v > 120) {
        const r = src[idx*4], g = src[idx*4+1], b = src[idx*4+2];
        pts.push({
          x: +(x / SRC_W).toFixed(4),
          y: +(y / SRC_H).toFixed(4),
          r, g, b,
          brightness: Math.round(v),
        });
      }
    }
  }

  console.log(`Extracted: ${pts.length} pixels`);

  // Separate by brightness for layering (high brightness = face lit areas)
  const hi = pts.filter(p => p.brightness > 160).map(p => ({ x: p.x, y: p.y }));
  const mid = pts.filter(p => p.brightness > 80 && p.brightness <= 160).map(p => ({ x: p.x, y: p.y }));
  const lo = pts.filter(p => p.brightness > 30 && p.brightness <= 80).map(p => ({ x: p.x, y: p.y }));

  console.log(`  High:   ${hi.length} (face lit)`);
  console.log(`  Mid:    ${mid.length} (mid tones)`);
  console.log(`  Low:    ${lo.length} (shadow/shirt)`);

  // Also extract a "glow" layer — pixels just outside bright areas for halo effect
  const all = { hi, mid, lo };

  const js = `// Musk portrait from photo — ${pts.length} total pixels
// Generated at ${SRC_W}x${SRC_H}, step=${STEP}
export const PORTRAIT_ALL  = ${JSON.stringify(pts)};
export const PORTRAIT_HI   = ${JSON.stringify(hi)};
export const PORTRAIT_MID  = ${JSON.stringify(mid)};
export const PORTRAIT_LO   = ${JSON.stringify(lo)};
export const TOTAL_COUNT   = ${pts.length};
`;

  writeFileSync(OUT_PATH, js);
  const kb = Math.round(Buffer.byteLength(js) / 1024);
  console.log(`Saved: ${OUT_PATH} (~${kb} KB)`);
}

main().catch(console.error);
