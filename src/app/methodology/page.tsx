/**
 * Prismatic — Methodology Page
 */

import type { Metadata } from 'next';
import MethodologyClient from './MethodologyClient';

export const metadata: Metadata = {
  title: '认知蒸馏方法论',
  description: '了解如何通过六层自动蒸馏管道，系统化提取真实思想家的心智模型、决策框架和表达DNA，获得可量化评估、可迭代改进的AI思维伙伴。',
  keywords: ['认知蒸馏', 'AI蒸馏', '心智模型', '思维框架', '人物蒸馏'],
};

export default function MethodologyPage() {
  return <MethodologyClient />;
}
