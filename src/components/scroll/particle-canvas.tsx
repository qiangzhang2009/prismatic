'use client';

/**
 * ParticleCanvas — 粒子星图，渲染 Persona 名字为点阵星图
 * - 汉字用 40x40 bitmap 骨架点阵
 * - 英文字母用 7-segment 风格
 * - 五种粒子风格：stars / circuit / waves / leaves / none
 */
import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface ParticleCanvasProps {
  initials: string;
  nameZh: string;
  primaryColor: string;
  secondaryColor: string;
  particleStyle: 'stars' | 'circuit' | 'waves' | 'leaves' | 'none';
  height?: number;
  bgValue: string;
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  color: string;
  size: number;
  opacity: number;
  phase: number;
  speed: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

interface Point3D { x: number; y: number; z: number; }

const PARTICLE_COUNT: Record<string, number> = {
  initials: 600, circuit: 180, waves: 120, leaves: 80, stars: 700, none: 0,
};

// 40x40 skeleton bitmaps — only edge pixels (1=on, 0=off)
// Each char: outer boundary + key inner strokes
const CHAR_BITMAPS: Record<string, number[][]> = {

// 维 — structure: outer box, inner cross
'维': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // Outer frame
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  // Inner cross strokes
  for(let i=10;i<=29;i++){b[18][i]=1;}
  for(let i=14;i<=27;i++){b[i][19]=1;}
  return b;
})(),

// 根 — structure: outer frame, inner 十 stroke
'根': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  for(let i=12;i<=27;i++){b[20][i]=1;}
  for(let i=15;i<=25;i++){b[i][19]=1;}
  return b;
})(),

// 斯 — structure: 其 + 斤
'斯': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // 其 (top part)
  for(let i=8;i<=31;i++){b[8][i]=1;b[20][i]=1;}
  for(let i=8;i<=20;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=10;i<=19;i++){b[14][i]=1;}
  // 斤 (bottom)
  for(let i=10;i<=29;i++){b[30][i]=1;}
  for(let i=16;i<=26;i++){b[i][19]=1;}
  for(let i=20;i<=30;i++){b[i][17+(i-20)]=1;}
  for(let i=20;i<=30;i++){b[i][21-(i-20)]=1;}
  return b;
})(),

// 坦 — structure: 土 + 旦
'坦': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // 土 (left)
  for(let i=8;i<=28;i++){b[26][i]=1;}
  for(let i=8;i<=16;i++){b[i][18]=1;}
  for(let i=18;i<=26;i++){b[i][18]=1;}
  for(let i=8;i<=26;i++){b[16][i]=1;}
  // 旦 (right)
  for(let i=20;i<=33;i++){b[10][i]=1;}
  for(let i=20;i<=33;i++){b[26][i]=1;}
  for(let i=10;i<=26;i++){b[i][20]=1;}
  for(let i=10;i<=26;i++){b[i][33]=1;}
  for(let i=21;i<=32;i++){b[18][i]=1;}
  return b;
})(),

// 特 — structure: 牛 + 寺
'特': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // 牛 (left part)
  for(let i=8;i<=28;i++){b[12][i]=1;}
  for(let i=8;i<=30;i++){b[i][18]=1;}
  for(let i=12;i<=18;i++){b[i][8]=1;}
  for(let i=12;i<=18;i++){b[i][28]=1;}
  for(let i=22;i<=30;i++){b[i][18]=1;}
  // 寺 (right part)
  for(let i=20;i<=32;i++){b[12][i]=1;}
  for(let i=20;i<=32;i++){b[26][i]=1;}
  for(let i=12;i<=26;i++){b[i][22]=1;}
  for(let i=12;i<=26;i++){b[i][30]=1;}
  for(let i=18;i<=22;i++){b[20][i]=1;}
  return b;
})(),

// 人 — structure: 人 shape (left+right strokes, top meeting)
'人': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=0;i<=15;i++){b[10+i][20-i]=1;}
  for(let i=0;i<=15;i++){b[10+i][20+i]=1;}
  return b;
})(),

// 道 — structure: outer + inner strokes
'道': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  for(let i=12;i<=27;i++){b[19][i]=1;}
  for(let i=15;i<=24;i++){b[i][19]=1;}
  // Arrow part (simplified)
  for(let i=16;i<=24;i++){b[10][i]=1;}
  for(let i=13;i<=20;i++){b[i][20]=1;}
  return b;
})(),

// 老 — structure: top + bottom strokes
'老': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[10][i]=1;}
  for(let i=8;i<=31;i++){b[30][i]=1;}
  for(let i=5;i<=33;i++){b[i][19]=1;}
  for(let i=12;i<=26;i++){b[20][i]=1;}
  return b;
})(),

// 子 — structure: top line + curved bottom
'子': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[12][i]=1;}
  for(let i=15;i<=25;i++){b[i][19]=1;}
  for(let i=12;i<=26;i++){b[28][i]=1;}
  for(let i=16;i<=22;i++){b[i][19+(i-16)]=1;}
  return b;
})(),

// 孔 — structure: outer + inner cross
'孔': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;}
  for(let i=10;i<=30;i++){b[i][19]=1;}
  for(let i=14;i<=24;i++){b[24][i]=1;}
  for(let i=10;i<=24;i++){b[i][14]=1;b[i][24]=1;}
  return b;
})(),

// 德 — structure: 彳 + 十 + 心
'德': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // 彳 (left radical)
  for(let i=12;i<=28;i++){b[14][i]=1;}
  for(let i=10;i<=14;i++){b[i][12]=1;}
  for(let i=10;i<=14;i++){b[i][18]=1;}
  for(let i=10;i<=14;i++){b[16+i-10][12+(i-10)]=1;}
  // 十 (middle)
  for(let i=14;i<=25;i++){b[19][i]=1;}
  for(let i=14;i<=26;i++){b[i][19]=1;}
  // 心 (bottom)
  b[28][15]=1;b[28][21]=1;b[28][26]=1;
  for(let i=15;i<=26;i++){b[32][i]=1;}
  for(let i=28;i<=32;i++){b[i][15+(i-28)]=1;b[i][26-(i-28)]=1;}
  return b;
})(),

// 天 — structure: two horizontal lines + sides
'天': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[12][i]=1;b[22][i]=1;}
  for(let i=0;i<=19;i++){b[12+i][10]=1;b[12+i][29]=1;}
  return b;
})(),

// 王 — structure: three horizontal + vertical
'王': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=11;i<=28;i++){b[10][i]=1;b[19][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][19]=1;}
  return b;
})(),

// 阳 — structure: outer frame + sun circle
'阳': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  for(let i=12;i<=27;i++){b[20][i]=1;}
  // Sun: horizontal and vertical through center
  for(let i=13;i<=26;i++){b[19][i]=1;}
  for(let i=13;i<=25;i++){b[i][19]=1;}
  return b;
})(),

// 明 — structure: two 日 boxes side by side
'明': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // Left 日
  for(let i=7;i<=17;i++){b[8][i]=1;b[22][i]=1;}
  for(let i=8;i<=22;i++){b[i][7]=1;b[i][17]=1;}
  for(let i=8;i<=16;i++){b[15][i]=1;}
  // Right 日
  for(let i=22;i<=32;i++){b[8][i]=1;b[22][i]=1;}
  for(let i=8;i<=22;i++){b[i][22]=1;b[i][32]=1;}
  for(let i=22;i<=31;i++){b[15][i]=1;}
  return b;
})(),

// 黑 — structure: outer + inner horizontal
'黑': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  for(let i=11;i<=28;i++){b[19][i]=1;}
  for(let i=13;i<=26;i++){b[26][i]=1;}
  for(let i=13;i<=26;i++){b[12][i]=1;}
  return b;
})(),

// 智 — structure: top 日 + bottom 大
'智': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // Top 日
  for(let i=10;i<=29;i++){b[8][i]=1;b[18][i]=1;}
  for(let i=8;i<=18;i++){b[i][10]=1;b[i][18]=1;}
  for(let i=10;i<=17;i++){b[13][i]=1;}
  // Bottom 大
  for(let i=12;i<=27;i++){b[30][i]=1;}
  for(let i=0;i<=16;i++){b[19+i][19-i]=1;}
  for(let i=0;i<=16;i++){b[19+i][19+i]=1;}
  return b;
})(),

// 慧 — structure: top + middle + bottom
'慧': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[14][i]=1;b[26][i]=1;b[32][i]=1;}
  for(let i=8;i<=32;i++){b[i][19]=1;}
  return b;
})(),

// 马 — structure: top + bottom strokes
'马': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[10][i]=1;b[30][i]=1;}
  for(let i=10;i<=30;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=10;i<=20;i++){b[20][i]=1;}
  return b;
})(),

// 云 — structure: two horizontal + sides
'云': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[12][i]=1;b[24][i]=1;}
  for(let i=0;i<=14;i++){b[12+i][12-i]=1;}
  for(let i=0;i<=14;i++){b[12+i][27+i-14]=1;}
  return b;
})(),

// 慈 — structure: similar to 慧
'慈': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[14][i]=1;b[26][i]=1;b[32][i]=1;}
  for(let i=8;i<=32;i++){b[i][19]=1;}
  return b;
})(),

// 爱 — structure: top + curved strokes
'爱': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;}
  for(let i=8;i<=20;i++){b[i][14]=1;b[i][25]=1;}
  for(let i=14;i<=25;i++){b[15][i]=1;}
  for(let i=17;i<=23;i++){b[i][19-(i-17)]=1;b[i][19+(i-17)]=1;}
  return b;
})(),

// 心 — structure: three dots + horizontal
'心': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  b[18][12]=1;b[18][19]=1;b[18][27]=1;
  for(let i=10;i<=29;i++){b[25][i]=1;}
  for(let i=18;i<=25;i++){b[i][12+(i-18)]=1;b[i][27-(i-18)]=1;}
  return b;
})(),

// 六 — structure: top dot + two wings
'六': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=14;i<=25;i++){b[12][i]=1;}
  for(let i=12;i<=22;i++){b[i][19-(i-12)]=1;}
  for(let i=12;i<=22;i++){b[i][19+(i-12)]=1;}
  for(let i=20;i<=32;i++){b[22][i]=1;}
  return b;
})(),

// 祖 — structure: outer + inner
'祖': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[6][i]=1;b[33][i]=1;}
  for(let i=6;i<=33;i++){b[i][8]=1;b[i][31]=1;}
  for(let i=13;i<=26;i++){b[16][i]=1;}
  for(let i=13;i<=26;i++){b[25][i]=1;}
  return b;
})(),

// 慧 — duplicate check but okay, has above

// 能 — structure: top + bottom
'能': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[16][i]=1;b[28][i]=1;}
  for(let i=8;i<=28;i++){b[i][19]=1;}
  return b;
})(),

// 路 — structure: 足 + 各
'路': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  // 足 (left part)
  for(let i=12;i<=16;i++){b[8][i]=1;}
  for(let i=14;i<=27;i++){b[14][i]=1;}
  for(let i=8;i<=14;i++){b[i][12]=1;b[i][16]=1;}
  for(let i=14;i<=20;i++){b[i][14]=1;}
  // 口 (foot bottom)
  for(let i=10;i<=18;i++){b[26][i]=1;}
  for(let i=18;i<=26;i++){b[i][18]=1;b[i][26]=1;}
  // 各 (right part)
  for(let i=22;i<=33;i++){b[8][i]=1;}
  for(let i=8;i<=28;i++){b[i][22]=1;}
  for(let i=16;i<=26;i++){b[16][i]=1;}
  for(let i=16;i<=28;i++){b[i][24]=1;}
  for(let i=22;i<=28;i++){b[24][i]=1;}
  for(let i=24;i<=32;i++){b[i][27+(i-24)]=1;}
  return b;
})(),

// 庄 — structure: top + sides
'庄': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;b[30][i]=1;}
  for(let i=10;i<=30;i++){b[i][19]=1;}
  return b;
})(),

// 严 — structure: top + bottom + sides
'严': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;b[30][i]=1;}
  for(let i=10;i<=30;i++){b[i][12]=1;b[i][27]=1;}
  for(let i=14;i<=25;i++){b[20][i]=1;}
  return b;
})(),

// 苏 — structure: grass top + bottom
'苏': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=15;i++){b[8][i+2]=1;}
  for(let i=20;i<=29;i++){b[8][i-6]=1;}
  for(let i=10;i<=29;i++){b[16][i]=1;}
  for(let i=10;i<=29;i++){b[i][19]=1;}
  for(let i=12;i<=26;i++){b[27][i]=1;}
  return b;
})(),

// 醒 — structure: 西 + 日 + 生
'醒': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=6;i<=14;i++){b[5][i]=1;b[16][i]=1;}
  for(let i=5;i<=16;i++){b[i][6]=1;b[i][14]=1;}
  for(let i=7;i<=13;i++){b[10][i]=1;}
  for(let i=18;i<=32;i++){b[10][i]=1;b[22][i]=1;}
  for(let i=10;i<=22;i++){b[i][25]=1;}
  for(let i=18;i<=25;i++){b[16][i]=1;}
  return b;
})(),

// 济 — structure: water radical + 齐
'济': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=5;i<=13;i++){b[8][i]=1;b[16][i]=1;}
  for(let i=8;i<=16;i++){b[i][9]=1;}
  for(let i=20;i<=33;i++){b[10][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][26]=1;}
  for(let i=22;i<=30;i++){b[i][20+(i-22)]=1;b[i][30-(i-22)]=1;}
  return b;
})(),

// 群 — structure: 君 + 羊
'群': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=30;i++){b[10][i]=1;}
  for(let i=10;i<=22;i++){b[i][19]=1;}
  for(let i=10;i<=19;i++){b[17][i]=1;}
  for(let i=8;i<=30;i++){b[28][i]=1;}
  for(let i=22;i<=28;i++){b[i][8]=1;b[i][14]=1;}
  for(let i=8;i<=14;i++){b[20][i]=1;}
  return b;
})(),

// 李 — structure: 木 + 子
'李': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[20][i]=1;}
  for(let i=12;i<=27;i++){b[10][i]=1;}
  for(let i=10;i<=20;i++){b[i][19]=1;}
  for(let i=12;i<=26;i++){b[29][i]=1;}
  for(let i=20;i<=29;i++){b[i][19]=1;}
  for(let i=22;i<=26;i++){b[i][19+(i-22)]=1;}
  return b;
})(),

// 瑜 — structure: 王 + 俞
'瑜': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=5;i<=12;i++){b[10][i]=1;b[19][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][8]=1;}
  for(let i=8;i<=32;i++){b[10][i]=1;b[20][i]=1;b[30][i]=1;}
  for(let i=10;i<=30;i++){b[i][20]=1;}
  for(let i=14;i<=26;i++){b[20][i]=1;}
  return b;
})(),

// 迦 — structure: 迦 simplified
'迦': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][12]=1;}
  for(let i=10;i<=28;i++){b[i][22]=1;}
  for(let i=18;i<=25;i++){b[i][17+(i-18)]=1;}
  return b;
})(),

// 勒 — structure: 勤 simplified
'勒': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[16][i]=1;}
  for(let i=8;i<=16;i++){b[i][19]=1;}
  for(let i=8;i<=33;i++){b[8][i]=1;b[32][i]=1;}
  for(let i=8;i<=32;i++){b[i][10]=1;b[i][30]=1;}
  for(let i=12;i<=28;i++){b[20][i]=1;}
  return b;
})(),

// 希 — structure: 布 + 44 dots
'希': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[20][i]=1;b[30][i]=1;}
  for(let i=8;i<=30;i++){b[i][19]=1;}
  for(let i=14;i<=24;i++){b[14][i]=1;}
  for(let i=10;i<=24;i++){b[i][14]=1;b[i][24]=1;}
  return b;
})(),

// 贤 — structure: 臣 + 贝
'贤': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=31;i++){b[8][i]=1;b[30][i]=1;}
  for(let i=8;i<=30;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=11;i<=28;i++){b[19][i]=1;}
  for(let i=10;i<=28;i++){b[24][i]=1;}
  for(let i=24;i<=30;i++){b[i][17]=1;b[i][21]=1;}
  return b;
})(),

// 虚 — structure: 虍 + 业
'虚': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;}
  for(let i=8;i<=16;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=11;i<=28;i++){b[12][i]=1;}
  for(let i=8;i<=16;i++){b[14][10+i-8]=1;}
  for(let i=20;i<=33;i++){b[12][i-2]=1;b[32][i-2]=1;}
  for(let i=12;i<=32;i++){b[i][15]=1;b[i][27]=1;}
  for(let i=17;i<=25;i++){b[22][i]=1;}
  return b;
})(),

// 诚 — structure: 言 + 成
'诚': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=6;i<=16;i++){b[8][i]=1;b[16][i]=1;}
  for(let i=8;i<=16;i++){b[i][11]=1;}
  for(let i=18;i<=33;i++){b[10][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][25]=1;}
  for(let i=16;i<=22;i++){b[i][20+(i-16)]=1;b[i][30-(i-16)]=1;}
  return b;
})(),

// 芒 — structure: grass + 亡
'芒': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=15;i++){b[8][i+2]=1;}
  for(let i=20;i<=29;i++){b[8][i-4]=1;}
  for(let i=12;i<=26;i++){b[16][i]=1;}
  for(let i=16;i<=28;i++){b[i][19]=1;}
  for(let i=12;i<=28;i++){b[i][19-(i-16)]=1;}
  return b;
})(),

// 果 — structure: 日 + 木
'果': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[18][i]=1;b[30][i]=1;}
  for(let i=8;i<=30;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=10;i<=18;i++){b[13][i]=1;}
  for(let i=18;i<=30;i++){b[i][19]=1;}
  return b;
})(),

// 光 — structure: 尣 + 火
'光': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[22][i]=1;}
  for(let i=12;i<=27;i++){b[12][i]=1;}
  for(let i=12;i<=22;i++){b[i][19]=1;}
  for(let i=19;i<=22;i++){b[12+i-19][12]=1;b[12+i-19][26]=1;}
  for(let i=14;i<=19;i++){b[i][17+(i-14)]=1;b[i][21-(i-14)]=1;}
  return b;
})(),

// 信 — structure: 亻 + 言
'信': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  b[10][8]=1;
  for(let i=10;i<=28;i++){b[i][11]=1;}
  for(let i=8;i<=16;i++){b[8][i]=1;b[16][i]=1;}
  for(let i=8;i<=16;i++){b[i][12]=1;}
  for(let i=10;i<=14;i++){b[12][i]=1;}
  for(let i=18;i<=32;i++){b[10][i]=1;b[26][i]=1;}
  for(let i=10;i<=26;i++){b[i][25]=1;}
  return b;
})(),

// 田 — structure: simple box grid
'田': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[10][i]=1;b[19][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][10]=1;b[i][19]=1;b[i][28]=1;}
  return b;
})(),

// 耕 — structure: 耒 + 井
'耕': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=6;i<=15;i++){b[12][i]=1;}
  for(let i=6;i<=12;i++){b[i][10]=1;}
  for(let i=14;i<=33;i++){b[12][i-2]=1;b[30][i-2]=1;}
  for(let i=12;i<=30;i++){b[i][16]=1;b[i][28]=1;}
  for(let i=18;i<=26;i++){b[21][i]=1;}
  for(let i=16;i<=21;i++){b[i][22]=1;}
  return b;
})(),

// 息 — structure: 自 + 心
'息': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[8][i]=1;b[18][i]=1;}
  for(let i=8;i<=18;i++){b[i][10]=1;b[i][29]=1;}
  for(let i=10;i<=17;i++){b[13][i]=1;}
  b[26][14]=1;b[26][19]=1;b[26][25]=1;
  for(let i=14;i<=25;i++){b[31][i]=1;}
  for(let i=26;i<=31;i++){b[i][14+(i-26)]=1;b[i][25-(i-26)]=1;}
  return b;
})(),

// 止 — structure: vertical + two horizontals
'止': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[12][i]=1;b[28][i]=1;}
  for(let i=12;i<=28;i++){b[i][19]=1;}
  return b;
})(),

// 观 — structure: 又 + 見
'观': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=14;i++){b[12][i]=1;b[20][i]=1;}
  for(let i=12;i<=20;i++){b[i][8]=1;b[i][14]=1;}
  for(let i=8;i<=18;i++){b[i][22]=1;b[i][32]=1;}
  for(let i=18;i<=32;i++){b[18][i]=1;b[32][i]=1;}
  for(let i=22;i<=32;i++){b[25][i]=1;}
  return b;
})(),

// 自 — structure: outer box + inner stroke
'自': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;b[26][i]=1;}
  for(let i=10;i<=26;i++){b[i][12]=1;b[i][27]=1;}
  for(let i=13;i<=26;i++){b[18][i]=1;}
  return b;
})(),

// 然 — structure: 肰 + 灬
'然': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=8;i<=15;i++){b[10][i]=1;b[20][i]=1;}
  for(let i=10;i<=20;i++){b[i][8]=1;b[i][15]=1;}
  for(let i=8;i<=15;i++){b[14][i]=1;}
  for(let i=18;i<=31;i++){b[12][i]=1;}
  for(let i=20;i<=33;i++){b[30][i]=1;}
  return b;
})(),

// 由 — structure: 田 with open top
'由': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[12][i]=1;b[26][i]=1;}
  for(let i=12;i<=26;i++){b[i][12]=1;b[i][27]=1;}
  for(let i=12;i<=19;i++){b[i][19]=1;}
  b[19][20]=1;
  return b;
})(),

// 中 — structure: outer + vertical
'中': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[10][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][19]=1;}
  return b;
})(),

// 医 — structure: 匚 + 矢
'医': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=28;i++){b[10][i]=1;b[28][i]=1;}
  for(let i=10;i<=28;i++){b[i][12]=1;}
  for(let i=14;i<=26;i++){b[19][i]=1;}
  for(let i=10;i<=19;i++){b[i][14+(i-10)]=1;b[i][26-(i-10)]=1;}
  return b;
})(),

// 哲 — structure: 折 + 口
'哲': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=19;i++){b[10][i]=1;}
  for(let i=10;i<=20;i++){b[i][14]=1;}
  for(let i=10;i<=14;i++){b[20][i]=1;}
  for(let i=10;i<=20;i++){b[i][19]=1;}
  for(let i=12;i<=22;i++){b[i][12+(i-12)]=1;b[i][21-(i-12)]=1;}
  for(let i=22;i<=30;i++){b[12][i]=1;b[22][i]=1;}
  for(let i=12;i<=22;i++){b[i][22]=1;}
  return b;
})(),

// 学 — structure: 冖 + 子 + 冖
'学': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=12;i<=27;i++){b[8][i]=1;}
  for(let i=8;i<=14;i++){b[14][8+(i-8)*0.6|0]=1;b[14][27-(i-8)*0.6|0]=1;}
  for(let i=14;i<=22;i++){b[i][19]=1;}
  for(let i=15;i<=23;i++){b[23][i]=1;}
  for(let i=22;i<=28;i++){b[i][19+(i-22)]=1;b[i][23-(i-22)]=1;}
  return b;
})(),

// 书 — structure: horizontal + vertical
'书': (() => {
  const b: number[][] = Array.from({length:40},()=>new Array(40).fill(0));
  for(let i=10;i<=29;i++){b[12][i]=1;}
  for(let i=12;i<=26;i++){b[i][19]=1;}
  for(let i=18;i<=26;i++){b[i][14+(i-18)]=1;}
  return b;
})(),

};

// 7-segment patterns for A-Z (simplified)
const SEG7: Record<string, number[][]> = {
  A: [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1]],
  B: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
  C: [[0,1,1,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,1],[0,1,1,0]],
  D: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
  E: [[1,1,1,1],[1,0,0,0],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
  F: [[1,1,1,1],[1,0,0,0],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0],[1,0,0,0]],
  G: [[0,1,1,0],[1,0,0,0],[1,0,0,0],[1,0,1,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  H: [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1]],
  I: [[1,1,1,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  J: [[0,0,1,1],[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1],[1,0,0,1],[0,1,1,0]],
  K: [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,1,0,0],[1,0,1,0],[1,0,0,1],[1,0,0,1]],
  L: [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
  M: [[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1]],
  N: [[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1]],
  O: [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  P: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0],[1,0,0,0]],
  Q: [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,1,1],[1,1,0,1],[0,1,1,1]],
  R: [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1],[1,0,0,1]],
  S: [[0,1,1,1],[1,0,0,0],[1,0,0,0],[0,1,1,0],[0,0,0,1],[0,0,0,1],[1,1,1,0]],
  T: [[1,1,1,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  U: [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  V: [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,1,0,0]],
  W: [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1],[0,1,0,1]],
  X: [[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1]],
  Y: [[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  Z: [[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
};

// Get skeleton points from 40x40 bitmap — also sample near edges for density
function buildCharSkeleton(bitmap: number[][], numSamples = 4): Point3D[] {
  const points: Point3D[] = [];
  const rows = bitmap.length;
  const cols = bitmap[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (bitmap[r][c] !== 1) continue;
      const n4 = [
        [r-1,c],[r+1,c],[r,c-1],[r,c+1]
      ].filter(([nr,nc]) => nr>=0&&nr<rows&&nc>=0&&nc<cols&&bitmap[nr][nc]===1).length;
      if (n4 < 4) {
        // This is an edge pixel — add multiple samples for more particles
        for (let s = 0; s < numSamples; s++) {
          points.push({
            x: c + (Math.sin(s * 1.37) * 0.4),
            y: r + (Math.cos(s * 1.91) * 0.4),
            z: 0
          });
        }
      }
    }
  }
  return points;
}

// Get 7-segment skeleton for a letter
function buildLetterSkeleton(seg: number[][], startX: number, startY: number, w: number, h: number): Point3D[] {
  const points: Point3D[] = [];
  const rows = seg.length;
  const cols = seg[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (seg[r][c] === 0) continue;
      const x = startX + (c / (cols - 1)) * w;
      const y = startY + (r / (rows - 1)) * h;
      points.push({ x, y, z: 0 });
    }
  }
  return points;
}

function getInitialsTargets(initials: string, width: number, height: number): Point3D[] {
  const points: Point3D[] = [];
  const chars = initials.slice(0, 2).toUpperCase();
  const charW = width * 0.35;
  const charH = height * 0.45;
  const totalW = charW * chars.length;
  const startX = (width - totalW) / 2;
  const startY = height * 0.25;

  for (let c = 0; c < chars.length; c++) {
    const seg = SEG7[chars[c]];
    if (seg) {
      points.push(...buildLetterSkeleton(seg, startX + c * charW, startY, charW, charH));
    } else {
      // Fallback: outline rectangle
      for (let i = 0; i <= 4; i++) {
        points.push({ x: startX + c * charW + (i / 4) * charW, y: startY, z: 0 });
        points.push({ x: startX + c * charW + (i / 4) * charW, y: startY + charH, z: 0 });
      }
      for (let i = 1; i < 4; i++) {
        points.push({ x: startX + c * charW, y: startY + (i / 4) * charH, z: 0 });
        points.push({ x: startX + c * charW + charW, y: startY + (i / 4) * charH, z: 0 });
      }
    }
  }
  return points;
}

function getStarPositions(nameZh: string, initials: string, width: number, height: number): Point3D[] {
  if (nameZh && nameZh.trim().length > 0) {
    const chars = nameZh.trim().slice(0, 6);
    const numChars = chars.length;
    const totalW = width * 0.92;
    const spacing = totalW / numChars;
    const startX = (width - totalW) / 2;
    const startY = height * 0.20;
    const cellH = height * 0.60;
    const points: Point3D[] = [];

    for (let ci = 0; ci < numChars; ci++) {
      const char = chars[ci];
      const charOffX = startX + ci * spacing;
      const bitmap = CHAR_BITMAPS[char];
      if (bitmap) {
        const skeleton = buildCharSkeleton(bitmap);
        for (const pt of skeleton) {
          const x = charOffX + (pt.x / 40) * spacing;
          const y = startY + (pt.y / 40) * cellH;
          points.push({ x, y, z: (ci - numChars / 2) * 12 });
        }
      } else {
        // Unknown char: fallback skeleton strokes
        const cx = charOffX + spacing / 2;
        const cy = startY + cellH / 2;
        const sw = spacing * 0.6;
        const sh = cellH * 0.6;
        for (let i = 0; i <= 4; i++) {
          points.push({ x: cx - sw/2 + (i/4)*sw, y: cy - sh/2, z: (ci - numChars/2)*12 });
          points.push({ x: cx - sw/2 + (i/4)*sw, y: cy + sh/2, z: (ci - numChars/2)*12 });
        }
        for (let i = 1; i < 4; i++) {
          points.push({ x: cx - sw/2, y: cy - sh/2 + (i/4)*sh, z: (ci - numChars/2)*12 });
          points.push({ x: cx + sw/2, y: cy - sh/2 + (i/4)*sh, z: (ci - numChars/2)*12 });
        }
      }
    }
    return points;
  }
  return getInitialsTargets(initials, width, height);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lerpColor(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, t: number) {
  return `rgb(${Math.round(c1.r+(c2.r-c1.r)*t)},${Math.round(c1.g+(c2.g-c1.g)*t)},${Math.round(c1.b+(c2.b-c1.b)*t)})`;
}

export function ParticleCanvas({
  initials, nameZh, primaryColor, secondaryColor,
  particleStyle, height = 480, bgValue,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rotationRef = useRef({ x: 0.12, y: 0.0 });
  const targetRotationRef = useRef({ x: 0.12, y: 0.0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const timeRef = useRef(0);
  const targetsRef = useRef<Point3D[]>([]);

  const primaryRgb = useMemo(() => hexToRgb(primaryColor), [primaryColor]);
  const secondaryRgb = useMemo(() => hexToRgb(secondaryColor), [secondaryColor]);

  const getParticleBehavior = useCallback((style: typeof particleStyle) => {
    switch (style) {
      case 'circuit': return { drift: 0.15, pulse: 0.8, flow: 0.3 };
      case 'waves':   return { drift: 0.25, pulse: 0.5, flow: 0.6 };
      case 'leaves':  return { drift: 0.4,  pulse: 0.2, flow: 0.5 };
      case 'stars':   return { drift: 0.25, pulse: 1.0, flow: 0.05 };
      default:        return { drift: 0.12, pulse: 0.6, flow: 0.2 };
    }
  }, []);

  const initParticles = useCallback((canvas: HTMLCanvasElement, targets: Point3D[]) => {
      const count = PARTICLE_COUNT[particleStyle] ?? 200;
      const particles: Particle[] = [];
    const numTarget = Math.max(1, targets.length);
      for (let i = 0; i < count; i++) {
      const target = targets[i % numTarget];
        const isPrimary = i % 3 !== 0;
      const spreadX = canvas.width * 0.6 / numTarget;
      const spreadY = canvas.height * 0.6 / numTarget;
        particles.push({
        x: target.x - spreadX + Math.random() * spreadX * 2,
        y: target.y - spreadY + Math.random() * spreadY * 2,
        z: (Math.random() - 0.5) * 40,
        vx: 0, vy: 0, vz: 0,
          color: isPrimary ? primaryColor : secondaryColor,
        size: Math.random() * (particleStyle === 'stars' ? 1.5 : 2) + 1.2,
        opacity: Math.random() * 0.4 + 0.4,
          phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.3 + 0.1,
        targetX: target ? target.x - canvas.width / 2 : 0,
        targetY: target ? target.y - canvas.height / 2 : 0,
        targetZ: target ? target.z : 0,
        });
      }
      particlesRef.current = particles;
  }, [particleStyle, primaryColor, secondaryColor]);

  const draw = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, targets: Point3D[]) => {
      const w = canvas.width;
      const h = canvas.height;
      const behavior = getParticleBehavior(particleStyle);
      ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = particleStyle === 'stars' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, w, h);

      const particles = particlesRef.current;
      if (!particles.length) return;

      timeRef.current += 0.016;
      const t = timeRef.current;
    targetRotationRef.current.y += 0.001;
    rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.03;
    rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.03;
    zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.06;
      const rx = rotationRef.current.x;
      const ry = rotationRef.current.y;
      const zoom = zoomRef.current;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);

    // Draw constellation lines between nearby particles (stars mode)
    if (particleStyle === 'stars' && targets.length > 2) {
      const lineDist = 60 * zoom;
      for (let pi = 0; pi < particles.length; pi++) {
        const p = particles[pi];
        const pz1 = p.y * sinX + p.z * cosX;
        const pz1b = -p.y * cosX + p.z * sinX;
        const ptx = p.x * cosY - pz1 * sinY;
        const pfz = p.x * sinY + pz1 * cosY;
        const psc = 600 / (600 + pfz + 300);
        if (psc < 0.01) continue;
        const psx = w/2 + ptx*psc, psy = h/2 + pz1b*psc;
        for (let pj = pi + 1; pj < Math.min(pi + 8, particles.length); pj++) {
          const p2 = particles[pj];
          const p2z1 = p2.y * sinX + p2.z * cosX;
          const p2z1b = -p2.y * cosX + p2.z * sinX;
          const p2tx = p2.x * cosY - p2z1 * sinY;
          const p2fz = p2.x * sinY + p2z1 * cosY;
          const p2sc = 600 / (600 + p2fz + 300);
          if (p2sc < 0.01) continue;
          const p2sx = w/2 + p2tx*p2sc, p2sy = h/2 + p2z1b*p2sc;
          const dx = psx - p2sx, dy = psy - p2sy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < lineDist && dist > 5) {
            ctx.globalAlpha = (1 - dist / lineDist) * 0.12 * psc;
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(psx, psy);
            ctx.lineTo(p2sx, p2sy);
            ctx.stroke();
          }
        }
      }
    }

      for (const p of particles) {
      p.x += (p.targetX - p.x) * behavior.drift * 0.12;
      p.y += (p.targetY - p.y) * behavior.drift * 0.12;
      p.z += (p.targetZ - p.z) * behavior.drift * 0.12;
        if (particleStyle !== 'none') {
        p.x += Math.sin(t * p.speed + p.phase) * behavior.flow * 1.5;
        p.y += Math.cos(t * p.speed * 0.7 + p.phase) * behavior.flow * 1.0;
        p.z += Math.sin(t * p.speed * 0.5 + p.phase * 2) * behavior.flow * 0.8;
      }
      const sx = p.x * zoom, sy = p.y * zoom, sz = p.z * zoom;
        const tz1 = sy * sinX + sz * cosX;
        const z1 = -sy * cosX + sz * sinX;
        const tx = sx * cosY - tz1 * sinY;
        const finalZ = sx * sinY + tz1 * cosY;
        const perspective = 600;
        const scale = perspective / (perspective + finalZ + 300);
        if (scale < 0.01) continue;
        const screenX = w / 2 + tx * scale;
        const screenY = h / 2 + z1 * scale;
      const depthAlpha = Math.max(0.15, Math.min(1, 1 - finalZ / 600));
      const pulse = Math.sin(t * behavior.pulse * 2 + p.phase) * 0.25 + 0.75;
        const finalOpacity = p.opacity * depthAlpha * pulse;
      const colorT = Math.sin(t * 0.2 + p.phase) * 0.5 + 0.5;
      const color = lerpColor(primaryRgb, secondaryRgb, colorT * 0.3);
      ctx.globalAlpha = finalOpacity;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      // Glow for stars
      if (particleStyle === 'stars' && scale > 0.25) {
        ctx.globalAlpha = finalOpacity * 0.15;
          ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * scale * 4, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, p.size * scale * 4);
          glow.addColorStop(0, color);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
  }, [particleStyle, primaryColor, primaryRgb, secondaryRgb, getParticleBehavior]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || particleStyle === 'none') return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      const targets = getStarPositions(nameZh, initials, canvas.width, canvas.height);
      targetsRef.current = targets;
      initParticles(canvas, targets);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let animId: number;
    const animate = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(canvas, ctx, targetsRef.current);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [particleStyle, initials, nameZh, initParticles, draw]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    targetRotationRef.current.y += dx * 0.004;
    targetRotationRef.current.x += dy * 0.004;
    targetRotationRef.current.x = Math.max(-0.5, Math.min(0.5, targetRotationRef.current.x));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleDoubleClick = useCallback(() => {
    targetRotationRef.current = { x: 0.12, y: 0 };
    targetZoomRef.current = 1;
    rotationRef.current = { x: 0.12, y: 0 };
    zoomRef.current = 1;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoomRef.current = Math.max(0.4, Math.min(2.5, targetZoomRef.current - e.deltaY * 0.0008));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  if (particleStyle === 'none') return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
      <div
        className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded pointer-events-none z-10"
        style={{ color: primaryColor, opacity: 0.25, fontSize: '0.6rem', letterSpacing: '0.1em', fontFamily: 'monospace' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
        {particleStyle === 'circuit' ? 'CIRCUIT' : particleStyle === 'stars' ? 'CONSTELLATION' : particleStyle === 'waves' ? 'WAVES' : 'PARTICLES'}
      </div>
      <div
        className="absolute top-0 inset-x-0 h-16 pointer-events-none z-[5]"
        style={{ background: `linear-gradient(to bottom, ${bgValue}, transparent)` }}
      />
    </div>
  );
}
