import { Metadata } from 'next';
import { ArrowLeft, Hexagon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TCMGraphClient } from './components/TCMGraphClient';
import type { TCMNode, TCMEdge } from './types';

export const metadata: Metadata = {
  title: '中医思想家影响力图谱 | Prismatic',
  description: '全球首个专业中医思想家动态知识图谱，涵盖 22 位历代名医、7 部经典典籍、6 种关系类型。可视化展示流派传承、派系对立、跨文化共鸣网络。',
  keywords: ['中医', '知识图谱', '张仲景', '黄帝内经', '流派', '中医史', '可视化'],
};

async function getGraphData(): Promise<{ nodes: TCMNode[]; edges: TCMEdge[] }> {
  try {
    const corpusRoot = join(process.cwd(), 'corpus', 'distilled', 'tcm');
    const nodesData = readFileSync(join(corpusRoot, 'tcm-nodes.json'), 'utf-8');
    const edgesData = readFileSync(join(corpusRoot, 'tcm-edges.json'), 'utf-8');
    return {
      nodes: JSON.parse(nodesData),
      edges: JSON.parse(edgesData),
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export default async function TCMGraphPage() {
  const { nodes, edges } = await getGraphData();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <div className="glass border-b border-white/5 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回</span>
        </Link>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Hexagon className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <Sparkles className="w-2 h-2 text-emerald-300 absolute -top-0.5 -right-0.5" />
          </div>
          <h1 className="font-display font-bold text-base gradient-text">
            中医思想家影响力图谱
          </h1>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          {nodes.length} 节点 · {edges.length} 条边
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 120px)' }}>
        <TCMGraphClient nodes={nodes} edges={edges} />
      </div>
    </div>
  );
}
