/**
 * Prismatic — Pricing Page
 */

import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
  title: '定价方案',
  description: '按需付费，不浪费一分钱。每次对话消耗对应条数，明码标价。充值条数永久有效，用完再买。免费体验每日10条对话额度。',
  keywords: ['定价', '付费', '订阅', '充值', '问答条数'],
};

export default function PricingPage() {
  return <PricingClient />;
}
