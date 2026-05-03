/**
 * TCM Assistant — Main Page
 * 多人物中医AI助手 · 中医出海SaaS MVP
 */

import { Metadata } from 'next';
import { TCMChatInterface } from '@/components/tcm-chat-interface';
import { TCM_PERSONA_LIST } from '@/lib/tcm-personas';

export const metadata: Metadata = {
  title: '中医AI助手 | Prismatic',
  description: '基于张仲景、华佗、孙思邈等19位古今中医大家的AI诊疗助手。输入症状，获取古籍引证的中医辨证分析。',
  keywords: ['中医AI', 'AI诊疗', '中医辨证', '古籍引证', '中医出海'],
};

export default function TCMAssistantPage() {
  return (
    <div className="pt-16">
      <TCMChatInterface />
    </div>
  );
}
