import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TCMAtlasClient } from './components/TCMAtlasClient';
import type { TCMNode, TCMEdge } from './types';
import tcmNodes from '@/lib/tcm-data/tcm-nodes.json';
import tcmEdges from '@/lib/tcm-data/tcm-edges.json';

export const metadata: Metadata = {
  title: '中医思想家影响力图谱 | Prismatic',
  description: '全球首个专业中医思想家动态知识图谱，涵盖 19 位历代名医、7 部经典典籍、6 种关系类型。可视化展示流派传承、派系对立、跨文化共鸣网络。',
  keywords: ['中医', '知识图谱', '张仲景', '黄帝内经', '流派', '中医史', '可视化'],
};

export default function TCMAtlasPage() {
  const nodes = tcmNodes as TCMNode[];
  const edges = tcmEdges as TCMEdge[];

  return (
    <div className="min-h-screen bg-[#050810] overflow-hidden">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center gap-4"
        style={{
          background: 'rgba(5,8,16,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Prismatic</span>
        </Link>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-3">
          {/* Yin-Yang mini icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
            <path d="M10 1 A9 9 0 0 1 10 19 A4.5 4.5 0 0 1 10 10 A4.5 4.5 0 0 0 10 1" fill="#c9a84c"/>
            <circle cx="10" cy="5.5" r="1.5" fill="#050810"/>
            <circle cx="10" cy="14.5" r="1.5" fill="#c9a84c"/>
          </svg>
          <h1 className="font-display font-bold text-base text-white tracking-tight">
            全球中医思想家影响力图谱
          </h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400/80 border border-amber-500/30 font-mono">
            TCM ATLAS
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400/70 inline-block" style={{ boxShadow: '0 0 6px rgba(251,191,36,0.5)' }} />
            {nodes.filter(n => n.type === 'person').length} 思想家
          </span>
          <span className="text-slate-700">·</span>
          <span>{nodes.filter(n => n.type === 'text').length} 经典</span>
          <span className="text-slate-700">·</span>
          <span>{edges.length} 条关系</span>
        </div>
      </div>

      {/* Main Canvas */}
      <TCMAtlasClient nodes={nodes} edges={edges} />
    </div>
  );
}
