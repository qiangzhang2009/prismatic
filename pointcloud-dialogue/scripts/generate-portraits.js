import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "assets");
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Portrait drawing helpers ──────────────────────────────────────────────────

function drawMusk(canvas, ctx) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  // Head shape — angular, elongated (Musk's distinctive long face)
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.47, w * 0.22, h * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Forehead
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.28, w * 0.17, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Strong brow ridge
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.32);
  ctx.quadraticCurveTo(w * 0.5, h * 0.24, w * 0.72, h * 0.32);
  ctx.quadraticCurveTo(w * 0.7, h * 0.38, w * 0.5, h * 0.40, w * 0.28, h * 0.38);
  ctx.closePath();
  ctx.fill();

  // Eyes — intense, focused gaze
  ctx.fillStyle = "#4A90D9"; // cold blue highlight
  ctx.beginPath();
  ctx.ellipse(w * 0.38, h * 0.37, w * 0.045, h * 0.022, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.37, w * 0.045, h * 0.022, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Eye whites
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(w * 0.38, h * 0.37, w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.37, w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#1A1A2E";
  ctx.beginPath();
  ctx.ellipse(w * 0.39, h * 0.37, w * 0.028, h * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.61, h * 0.37, w * 0.028, h * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose — strong, straight bridge
  ctx.fillStyle = "#d8d8d8";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.40);
  ctx.lineTo(w * 0.46, h * 0.50);
  ctx.lineTo(w * 0.47, h * 0.50);
  ctx.lineTo(w * 0.5, h * 0.44);
  ctx.lineTo(w * 0.53, h * 0.50);
  ctx.lineTo(w * 0.54, h * 0.50);
  ctx.closePath();
  ctx.fill();

  // Mouth — slight smirk
  ctx.fillStyle = "#c0c0c0";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#c0c0c0";
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.55);
  ctx.quadraticCurveTo(w * 0.5, h * 0.575, w * 0.65, h * 0.545);
  ctx.stroke();

  // Goatee / chin beard
  ctx.fillStyle = "#888888";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.63, w * 0.06, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Side hair — shorter
  ctx.fillStyle = "#333333";
  ctx.beginPath();
  ctx.ellipse(w * 0.28, h * 0.35, w * 0.05, h * 0.10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.35, w * 0.05, h * 0.10, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Top hair — tousled, less formal
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.18, w * 0.20, h * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.18);
  ctx.quadraticCurveTo(w * 0.4, h * 0.08, w * 0.45, h * 0.14);
  ctx.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.55, h * 0.14);
  ctx.quadraticCurveTo(w * 0.6, h * 0.08, w * 0.65, h * 0.18);
  ctx.fill();

  // Shoulders hint
  ctx.fillStyle = "#555555";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.85, w * 0.35, h * 0.18, 0, 0, Math.PI);
  ctx.fill();
}

function drawJobs(canvas, ctx) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;

  // Head shape — rounder, more compact (Jobs' signature look)
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.47, w * 0.19, h * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();

  // Forehead
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.28, w * 0.15, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bald head — smooth, clean
  ctx.fillStyle = "#e8e8e8";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.22, w * 0.155, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wrinkled forehead
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.38 + i * 0.025 * w, h * 0.26);
    ctx.quadraticCurveTo(w * 0.5, h * 0.24 + i * 0.012 * h, w * 0.62 - i * 0.025 * w, h * 0.26);
    ctx.stroke();
  }

  // Eyes — thoughtful, deep-set
  ctx.fillStyle = "#F5F5F7"; // Apple silver white
  ctx.beginPath();
  ctx.ellipse(w * 0.38, h * 0.36, w * 0.065, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.36, w * 0.065, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris — warm, intelligent
  ctx.fillStyle = "#8E8E93"; // warm grey
  ctx.beginPath();
  ctx.ellipse(w * 0.38, h * 0.36, w * 0.038, h * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.36, w * 0.038, h * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#1C1C1E";
  ctx.beginPath();
  ctx.ellipse(w * 0.39, h * 0.36, w * 0.018, h * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.61, h * 0.36, w * 0.018, h * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose — distinctive dorsal hump (Jobs' signature)
  ctx.fillStyle = "#d0d0d0";
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.38);
  ctx.quadraticCurveTo(w * 0.44, h * 0.44, w * 0.46, h * 0.50);
  ctx.quadraticCurveTo(w * 0.5, h * 0.53, w * 0.54, h * 0.50);
  ctx.quadraticCurveTo(w * 0.56, h * 0.44, w * 0.52, h * 0.38);
  ctx.closePath();
  ctx.fill();

  // Mouth — thin, serious line
  ctx.fillStyle = "#b0b0b0";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#b0b0b0";
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.565);
  ctx.quadraticCurveTo(w * 0.5, h * 0.555, w * 0.6, h * 0.565);
  ctx.stroke();

  // Black turtleneck collar
  ctx.fillStyle = "#1C1C1E";
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.67);
  ctx.quadraticCurveTo(w * 0.5, h * 0.60, w * 0.65, h * 0.67);
  ctx.lineTo(w * 0.7, h * 0.80);
  ctx.quadraticCurveTo(w * 0.5, h * 0.74, w * 0.3, h * 0.80);
  ctx.closePath();
  ctx.fill();

  // Shoulders — turtleneck sweater
  ctx.fillStyle = "#1C1C1E";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.88, w * 0.38, h * 0.20, 0, 0, Math.PI);
  ctx.fill();
}

function drawGalaxy(canvas, ctx) {
  const w = canvas.width;
  const h = canvas.height;

  // Stars background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.2;
    const alpha = Math.random() * 0.6 + 0.1;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spiral arm suggestion
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 4; t += 0.05) {
      const r = t * 25;
      const x = w / 2 + r * Math.cos(t + (arm * Math.PI));
      const y = h / 2 + r * Math.sin(t + (arm * Math.PI)) * 0.6;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ─── Pixel extraction ─────────────────────────────────────────────────────────

function extractPoints(canvas, threshold = 240) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const points = [];
  const step = 2; // sample every N pixels for manageable count

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 150 && (r + g + b) / 3 > threshold) {
        // Normalize to 0–1
        points.push({
          x: parseFloat((x / canvas.width).toFixed(4)),
          y: parseFloat((y / canvas.height).toFixed(4)),
          r,
          g,
          b,
          a,
        });
      }
    }
  }
  return points;
}

function extractStars(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const points = [];

  for (let y = 0; y < canvas.height; y += 3) {
    for (let x = 0; x < canvas.width; x += 3) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 50) {
        const brightness = (r + g + b) / 3;
        points.push({
          x: parseFloat((x / canvas.width).toFixed(4)),
          y: parseFloat((y / canvas.height).toFixed(4)),
          r,
          g,
          b,
          a: brightness,
        });
      }
    }
  }
  return points;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const SIZE = 800;

const muskCanvas = createCanvas(SIZE, SIZE);
const muskCtx = muskCanvas.getContext("2d");
drawMusk(muskCanvas, muskCtx);
const muskPoints = extractPoints(muskCanvas, 220);

const jobsCanvas = createCanvas(SIZE, SIZE);
const jobsCtx = jobsCanvas.getContext("2d");
drawJobs(jobsCanvas, jobsCtx);
const jobsPoints = extractPoints(jobsCanvas, 200);

const galaxyCanvas = createCanvas(SIZE, SIZE);
const galaxyCtx = galaxyCanvas.getContext("2d");
drawGalaxy(galaxyCanvas, galaxyCtx);
const starPoints = extractStars(galaxyCanvas);

const OUTPUT = {
  musk: {
    count: muskPoints.length,
    points: muskPoints,
  },
  jobs: {
    count: jobsPoints.length,
    points: jobsPoints,
  },
  stars: {
    count: starPoints.length,
    points: starPoints,
  },
};

writeFileSync(
  join(OUTPUT_DIR, "portraits.json"),
  JSON.stringify(OUTPUT, null, 0)
);

console.log(`Musk points:  ${muskPoints.length}`);
console.log(`Jobs points:   ${jobsPoints.length}`);
console.log(`Star points:   ${starPoints.length}`);
console.log(`Saved to:      ${join(OUTPUT_DIR, "portraits.json")}`);
