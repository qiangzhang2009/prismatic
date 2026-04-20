import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets");

// ── Musk ──────────────────────────────────────────────────────────────────────
const muskCanvas = createCanvas(800, 800);
const m = muskCanvas.getContext("2d");
m.fillStyle = "#fff";
m.strokeStyle = "#fff";
m.lineWidth = 2;

m.beginPath(); m.ellipse(400, 376, 176, 240, 0, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(400, 224, 136, 112, 0, 0, Math.PI * 2); m.fill();

m.fillStyle = "#4A90D9";
m.beginPath(); m.ellipse(304, 296, 36, 18, -0.1, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(496, 296, 36, 18, 0.1, 0, Math.PI * 2); m.fill();
m.fillStyle = "#fff";
m.beginPath(); m.ellipse(304, 296, 56, 28, 0, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(496, 296, 56, 28, 0, 0, Math.PI * 2); m.fill();
m.fillStyle = "#1A1A2E";
m.beginPath(); m.ellipse(312, 296, 22, 18, 0, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(488, 296, 22, 18, 0, 0, Math.PI * 2); m.fill();

m.fillStyle = "#333"; m.lineWidth = 3; m.strokeStyle = "#c0c0c0";
m.beginPath(); m.moveTo(304, 440); m.quadraticCurveTo(400, 460, 520, 436); m.stroke();
m.fillStyle = "#888";
m.beginPath(); m.ellipse(400, 504, 48, 40, 0, 0, Math.PI * 2); m.fill();
m.fillStyle = "#333";
m.beginPath(); m.ellipse(224, 280, 40, 80, 0.3, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(576, 280, 40, 80, -0.3, 0, Math.PI * 2); m.fill();
m.beginPath(); m.ellipse(400, 144, 160, 80, 0, 0, Math.PI * 2); m.fill();
m.beginPath(); m.moveTo(280,144); m.quadraticCurveTo(320,64,360,112);
m.quadraticCurveTo(400,48,440,112); m.quadraticCurveTo(480,64,520,144); m.fill();

m.fillStyle = "#555";
m.beginPath(); m.ellipse(400, 680, 280, 144, 0, Math.PI, Math.PI * 2); m.fill();

// ── Jobs ──────────────────────────────────────────────────────────────────────
const jobsCanvas = createCanvas(800, 800);
const j = jobsCanvas.getContext("2d");
j.fillStyle = "#fff"; j.strokeStyle = "#fff"; j.lineWidth = 2;

j.beginPath(); j.ellipse(400, 376, 152, 216, 0, 0, Math.PI * 2); j.fill();
j.beginPath(); j.ellipse(400, 224, 120, 96, 0, 0, Math.PI * 2); j.fill();
j.fillStyle = "#e8e8e8";
j.beginPath(); j.ellipse(400, 176, 124, 72, 0, 0, Math.PI * 2); j.fill();
j.strokeStyle = "#ccc"; j.lineWidth = 1.5;
for (let i = 0; i < 3; i++) {
  j.beginPath();
  j.moveTo(304 + i*20, 208); j.quadraticCurveTo(400, 192 + i*10, 496 - i*20, 208);
  j.stroke();
}

j.fillStyle = "#F5F5F7";
j.beginPath(); j.ellipse(304, 288, 52, 26, 0, 0, Math.PI * 2); j.fill();
j.beginPath(); j.ellipse(496, 288, 52, 26, 0, 0, Math.PI * 2); j.fill();
j.fillStyle = "#8E8E93";
j.beginPath(); j.ellipse(304, 288, 30, 22, 0, 0, Math.PI * 2); j.fill();
j.beginPath(); j.ellipse(496, 288, 30, 22, 0, 0, Math.PI * 2); j.fill();
j.fillStyle = "#1C1C1E";
j.beginPath(); j.ellipse(312, 288, 14, 14, 0, 0, Math.PI * 2); j.fill();
j.beginPath(); j.ellipse(488, 288, 14, 14, 0, 0, Math.PI * 2); j.fill();

j.fillStyle = "#d0d0d0";
j.beginPath(); j.moveTo(384, 304); j.quadraticCurveTo(352, 352, 368, 400);
j.quadraticCurveTo(400, 424, 432, 400); j.quadraticCurveTo(448, 352, 416, 304); j.closePath(); j.fill();

j.fillStyle = "#b0b0b0"; j.lineWidth = 2.5; j.strokeStyle = "#b0b0b0";
j.beginPath(); j.moveTo(320, 452); j.quadraticCurveTo(400, 444, 480, 452); j.stroke();

j.fillStyle = "#1C1C1E";
j.beginPath(); j.moveTo(280, 536); j.quadraticCurveTo(400, 480, 520, 536);
j.lineTo(560, 640); j.quadraticCurveTo(400, 592, 240, 640); j.closePath(); j.fill();
j.beginPath(); j.ellipse(400, 704, 304, 160, 0, Math.PI, Math.PI * 2); j.fill();

// ── Extract with sampling ─────────────────────────────────────────────────────
function extract(canvas, threshold = 200, step = 3) {
  const ctx = canvas.getContext("2d");
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pts = [];
  for (let y = 0; y < canvas.height; y += step)
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      if (d[i+3] > 150 && (d[i]+d[i+1]+d[i+2])/3 > threshold)
        pts.push({ x: +((x/canvas.width).toFixed(4)), y: +((y/canvas.height).toFixed(4)) });
    }
  return pts;
}

const muskPts = extract(muskCanvas, 220, 3);
const jobsPts = extract(jobsCanvas, 200, 3);

// Stars
const stCanvas = createCanvas(800, 800);
const st = stCanvas.getContext("2d");
st.fillStyle = "#000"; st.fillRect(0,0,800,800);
for (let i=0;i<800;i++){
  const x=Math.random()*800, y=Math.random()*800, r=Math.random()*1.2;
  const a=Math.random()*0.5+0.1;
  st.fillStyle=`rgba(255,255,255,${a})`;
  st.beginPath(); st.arc(x,y,r,0,Math.PI*2); st.fill();
}
const starPts = extract(stCanvas, 30, 4);

// ── Write JS module ───────────────────────────────────────────────────────────
const js = `// Generated point cloud data — ${muskPts.length} Musk, ${jobsPts.length} Jobs, ${starPts.length} stars
// These are normalized 0-1 coordinates, scaled to canvas size at runtime.

export const muskPoints = ${JSON.stringify(muskPts)};
export const jobsPoints = ${JSON.stringify(jobsPts)};
export const starPoints  = ${JSON.stringify(starPts)};
`;

writeFileSync(join(OUT, "particles.js"), js);
const sizeKb = Math.round(Buffer.byteLength(js) / 1024);
console.log(`Musk: ${muskPts.length} pts | Jobs: ${jobsPts.length} pts | Stars: ${starPts.length} pts`);
console.log(`particles.js: ~${sizeKb} KB`);
