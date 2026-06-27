/**
 * Prismatic — Personas Page
 */

import type { Metadata } from 'next';
import PersonasClient from './PersonasClient';

export const metadata: Metadata = {
  title: '人物档案馆',
  description: '浏览和探索棱镜折射的所有蒸馏人物，涵盖哲学、投资、科技、科学、东方智慧等领域。找到最适合你的思维伙伴。',
  keywords: ['AI人物', '蒸馏人物', '思维伙伴', '思想家', '哲学人物'],
};

export default function PersonasPage() {
  return <PersonasClient />;
}
