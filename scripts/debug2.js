const fs = require("fs");
const content = fs.readFileSync("src/lib/personas.ts", "utf-8");

// Find where confucius went
const conf1 = content.indexOf('PERSONAS["confucius"]');
const conf2 = content.indexOf("PERSONAS['confucius']");
console.log("Double-quote confucius:", conf1);
console.log("Single-quote confucius:", conf2);

// Find alan-turing  
const alan1 = content.indexOf('PERSONAS["alan-turing"]');
const alan2 = content.indexOf("PERSONAS['alan-turing']");
console.log("Double-quote alan-turing:", alan1);
console.log("Single-quote alan-turing:", alan2);

// Check what is around the transition from confucius to wittgenstein
const witStart = content.indexOf("PERSONAS['wittgenstein']");
console.log("\nwittgenstein starts at:", witStart);
if (witStart >= 0) {
  const witLine = content.slice(0, witStart).split("\n").length;
  console.log("wittgenstein line:", witLine);
  // Show 30 lines before wittgenstein
  const lines = content.slice(0, witStart).split("\n");
  console.log("=== 30 lines before wittgenstein ===");
  for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
    console.log((i+1) + ": " + lines[i].slice(0, 120));
  }
}
