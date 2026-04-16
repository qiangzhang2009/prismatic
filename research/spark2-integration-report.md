# Spark 2.0 与棱镜折射 Prismatic 集成可行性研究报告

> 研究日期：2026-04-16
> 来源：https://www.worldlabs.ai/blog/spark-2.0 + https://github.com/sparkjsdev/spark

---

## 一、核心结论

**可以应用，但性价比不高——不推荐作为优先方向。**

技术层面完全可行，Spark 2.0 可通过 npm 安装、集成到 Next.js App Router。理论上可以在 Persona 详情页加入 3D 场景作为视觉增强。但它解决的不是棱镜折射的核心问题，产品核心价值不会因此提升。

---

## 二、Spark 2.0 是什么

### 技术定位
World Labs 出品的 **3D Gaussian Splatting (3DGS) 网页渲染器**，基于 THREE.js + WebGL2，由 Rust 编译为 WebAssembly 运行。

### 核心技术能力

| 能力 | 说明 |
|------|------|
| **LoD 多细节层次** | 自动根据视角距离选择渲染精度，远处用大块 splat，近处用小块，保证帧率稳定 |
| **流式加载** | 新增 `.RAD` 文件格式（类似"虚拟内存分页"），64KB 为一个 chunk，按需从网络加载，支持数亿 splats 场景 |
| **多对象全局排序** | 多个 3DGS 对象在同一个场景中能正确前后排序（不会穿模） |
| **实时编辑/着色器图** | 支持 GLSL 或可视化节点图实时编辑 splat 颜色、透明度、做动画 |
| **跨设备兼容** | 瞄准 WebGL2（覆盖 98%+ 设备），比 WebGPU 更广泛 |

### 技术架构三步走

```
1. Generate  ──► 合并所有 3DGS 对象的 splats 到统一列表
2. Sort      ──► 按当前视角从后往前排序（Web Worker + 两遍基数排序）
3. Render    ──► 单次 instanced draw call 完成渲染
```

### LoD Splat Tree 原理

- 构建一棵多叉树：叶子节点是最精细的原始 splats，内部节点是若干子 splats 合并后的低分辨率近似
- 遍历树时用优先队列，从根往下挑，保证每个像素在屏幕上大小接近
- 全局 splat 预算（桌面 2.5M，移动 1.5M）保证帧率恒定

### 文件格式

| 格式 | 特点 |
|------|------|
| `.PLY` | 行存储，无压缩，10M splats 约 2.3GB |
| `.SPZ` | 列存储+Gzip 压缩，10M splats 约 200-250MB |
| `.RAD`（新） | 列存储+分块（每块 64KB），支持随机访问流式加载，支持 JSON 元数据扩展 |

### 安装方式

```bash
npm install @sparkjsdev/spark

# 构建 LoD 树（需要 Rust）
npm run build-lod -- my-splats.ply --quality --rad-chunked

# 流式加载
const splats = new SplatMesh({ url: "./my-splats-lod.rad", paged: true });
```

---

## 三、棱镜折射 Prismatic 是什么

- **产品类型**：AI 多智能体对话协作平台
- **核心价值**：认知蒸馏（Cognitive Distillation）—— 让乔布斯、马斯克、芒格、费曼等 48 个卓越思考者"同时为你思考"
- **四种协作模式**：Solo 对话 / 折射视图 / 圆桌辩论 / 任务模式
- **技术栈**：Next.js 14 + TypeScript + Framer Motion + Vercel AI SDK + Neon PostgreSQL

---

## 四、集成场景分析

### 场景 A：Persona 数字形象展示（最推荐）

在每个 Persona 档案页的 scroll 区域嵌入一个 **3D splat 场景**，作为 Persona 的"数字驻场"——用户进入页面时先看到流式加载的 3D 人物场景，然后 scroll 继续展示现有内容。

**视觉概念**：人物工作室/工坊环境，摆放与其领域相关的物品（乔布斯放 NeXT/Apple 产品，芒格放书架报纸等）

**难度**：⭐⭐⭐（中等，需要 WebGL + 3D 内容制作经验）

### 场景 B：首页 Hero 沉浸式入口

替换当前首页静态/视频 Hero 为**交互式 3D 场景**，用户可拖拽旋转，看到多个 Persona 的代表元素。

**难度**：⭐⭐⭐⭐（较高）

### 场景 C：辩论场视觉包装

在智辩场的旁观/投票界面引入 3D 粒子/光效作为氛围背景。

**难度**：⭐⭐⭐（中等，但 ROI 较低）

---

## 五、关键挑战与风险

### 技术壁垒

1. **Rust 编译链依赖**：`build-lod` 需要本地安装 Rust，为每个 Persona 的 3D 场景执行 LoD 编译。CI/CD 流程需要支持 Rust 工具链。
2. **.RAD 文件托管**：每个 LoD 场景是一个 `.rad` + `.radc` 分块文件集（轻则几十 MB），需要可靠的 CDN（Vercel Blob / Cloudflare R2）。
3. **Next.js App Router SSR 问题**：Spark 需要 DOM 中的 Canvas，SSR/SSG 页面需要 `dynamic(() => import(...), { ssr: false })` 水合处理。
4. **移动端 GPU 内存限制**：移动设备上限约 1.5M splats，需要精细调参，现有 Framer Motion 动画反而更流畅。

### 产品定位风险

5. **用户体验断层**：当前 Persona 页的 scroll 体验（astro-profile、soul-portrait 等）已很精致，引入 3DGS 后若加载慢或交互不直观，会拉低体验。
6. **内容制作成本**：每个 Persona 需要单独制作 3D 场景，内容生产工作量不小。
7. **核心价值不增强**：3DGS 不提升对话质量、多智能体协作效率——这些才是产品的护城河。

---

## 六、推荐实施路线（如果要集成）

### 阶段一：最小可行实验（1-2 周）

选 **1 个 Persona**（建议乔布斯或马斯克，视觉辨识度最高）做完整端到端验证：

**步骤**：

1. `npm install @sparkjsdev/spark`
2. 用 `npm run build:wasm` 构建 Rust/Wasm 组件（需要先装 Rust）
3. 用 Polycam / Metashape 扫描或用 [Marble.worldlabs.ai](https://marble.worldlabs.ai/) 生成该 Persona 的 3D 场景 `.ply` 文件
4. 运行 `npm run build-lod -- persona.ply --quality --rad-chunked` 生成 `.rad` 文件
5. 创建 Next.js Client Component 集成 Spark LoD renderer
6. 在 `personas/[slug]/scroll/page.tsx` 添加 3D canvas section，与现有 scroll 动画并排
7. 评估：加载速度 / 视觉质量 / 移动端表现 / 用户反馈

**参考代码框架**：

```typescript
// src/components/persona-3d-viewer.tsx
'use client';

import { useEffect, useRef } from 'react';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';

export function Persona3DViewer({ radUrl }: { radUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / 400,
      0.01,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, 400);
    containerRef.current.appendChild(renderer.domElement);

    const spark = new SparkRenderer({ renderer });
    scene.add(spark);

    const splats = new SplatMesh({ url: radUrl, paged: true });
    scene.add(splats);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [radUrl]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded-2xl overflow-hidden"
    />
  );
}
```

**在页面中使用**：

```typescript
// personas/[slug]/scroll/page.tsx
import dynamic from 'next/dynamic';

const Persona3DViewer = dynamic(
  () => import('@/components/persona-3d-viewer'),
  { ssr: false }
);

// 在 scroll 容器中合适位置加入：
<Suspense fallback={<div className="h-[400px] skeleton" />}>
  <Persona3DViewer radUrl={`/splats/${persona.slug}-lod.rad`} />
</Suspense>
```

### 阶段二：扩展验证

- 如果阶段一反馈正面，扩展到其他 5-8 个核心 Persona
- 将 Framer Motion scroll 进度映射到 3D 相机旋转（联动）
- 调优 LoD 参数（`lodSplatScale`、`coneFov` 等）适配不同设备

### 阶段三：差异化探索

- 用户在对话过程中触发 3D 场景变化（如辩论激烈时产生光效变化）
- 引入 WebXR 支持，让 Vision Pro / Quest 用户进入 3D Persona 空间

---

## 七、不集成的理由总结

| 原因 | 说明 |
|------|------|
| 产品核心偏离 | 棱镜折射的核心是"思维协作"，不是"视觉沉浸" |
| 工程成本高 | Rust/Wasm 工具链 + LoD 预构建 + 3D 内容制作 |
| 维护负担重 | 额外依赖 + 3D 内容持续更新 |
| 性能风险 | 移动端 GPU 限制可能导致体验不如现有动画 |
| 当前 UI 足够好 | Framer Motion scroll 动画已提供丰富视觉层次 |

---

## 八、一句话总结

技术可行，但它解决的不是你产品的问题。先用 1 个 Persona 小范围验证，确认视觉价值大于工程成本后再决定是否扩展。

---

## 九、最终方案：Particle Canvas（已实施，2026-04-16）

放弃 3DGS 大文件方案（132MB/人，不可接受）。改为轻量粒子光效：

### 粒子画布 vs 3DGS

| 指标 | 粒子画布 | 3DGS RAD |
|------|---------|-----------|
| 文件大小 | ~25KB（TypeScript） | 132MB/人 |
| 首屏加载 | < 50ms | 1-2 分钟 |
| 网络流量 | 零额外流量 | 每次访问 132MB |
| 视觉效果 | 粒子聚合名字/轮廓 | 完整 3D 场景 |
| 依赖 | Three.js（已安装） | Rust + WASM 构建链 |
| 适用性 | 所有 Persona | 仅指定 Persona |

### 粒子风格（来自 persona-scroll-themes.ts）

| 风格 | 视觉效果 | 适用领域 |
|------|---------|---------|
| `stars` | 星星闪烁+光晕 | philosophy / science / psychology |
| `circuit` | 电路板连线 | technology / engineering / AI |
| `waves` | 波纹扩散 | design / creativity / spirituality |
| `leaves` | 落叶飘零 | zen-buddhism |
| `none` | 无粒子效果 | （默认fallback） |

### 已创建文件

| 文件 | 说明 |
|------|------|
| `src/components/scroll/particle-canvas.tsx` | 粒子画布组件 |
| `src/app/personas/[slug]/scroll/client.tsx` | 已集成，对所有 particleStyle ≠ 'none' 的 Persona 显示 |
| `spark-src/` | 保留（Rust 构建工具链） |
| `scripts/download_splat_scene.py` | 保留（未来需要时可用） |

### 删除的大文件

- `public/spark/` — 整个目录（4.9MB WASM bundle）
- `public/splats/*.rad` — 所有 RAD 场景文件
- `src/components/persona-3d-viewer.tsx` — 3DGS viewer 组件

### 如果未来需要真正的 3DGS

Spark 工具链（`spark-src/`、`scripts/download_splat_scene.py`）已完整保留。需要时：

1. 用 Polycam 或 Metashape 扫描人物
2. 下载 `.ply` 文件
3. `python3 scripts/download_splat_scene.py --build scan.ply --quality`
4. 将生成的 `.rad` 文件上传 CDN
5. 在 `SPLAT_PERSONAS` 中添加 persona → CDN URL 映射
