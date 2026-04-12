'use client';

/**
 * Prismatic — Site Footer with Legal Disclaimer & Group Links
 */

import Link from 'next/link';
import { Hexagon, Github, Mail, Globe, ExternalLink } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

const GROUP_LINKS = [
  { href: 'https://www.zxqconsulting.com/', label: '集团官网' },
  { href: 'https://global-trade.zxqconsulting.com/', label: '全球贸易' },
  { href: 'https://africa.zxqconsulting.com/', label: '非洲业务' },
  { href: 'https://global2china.zxqconsulting.com/', label: '外资入华' },
  { href: 'https://quotation-japan.zxqconsulting.com/zh', label: '日本报价' },
  { href: 'https://global-legal-info.zxqconsulting.com/', label: '全球法务' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle bg-bg-base">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Group Links Banner */}
        <div className="mb-8 p-4 rounded-2xl border border-border-subtle bg-bg-elevated">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-prism-blue" />
            <span className="text-xs font-medium text-text-secondary">集团站点</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GROUP_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bg-surface border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-medium transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
              <span className="font-display font-bold gradient-text">{APP_NAME}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              折射人类最卓越的思维之光，让卓越灵魂为你思考、辩论与协作。
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-3">产品</h4>
            <ul className="space-y-2">
              <li><Link href="/app" className="text-xs text-text-muted hover:text-text-primary transition-colors">在线体验</Link></li>
              <li><Link href="/personas" className="text-xs text-text-muted hover:text-text-primary transition-colors">人物档案馆</Link></li>
              <li><Link href="/clash" className="text-xs text-text-muted hover:text-text-primary transition-colors">关公战秦琼</Link></li>
              <li><Link href="/methodology" className="text-xs text-text-muted hover:text-text-primary transition-colors">蒸馏方法论</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-3">资源</h4>
            <ul className="space-y-2">
              <li><Link href="/confidence" className="text-xs text-text-muted hover:text-text-primary transition-colors">置信度说明</Link></li>
              <li><Link href="/graph" className="text-xs text-text-muted hover:text-text-primary transition-colors">知识图谱</Link></li>
              <li><Link href="/compare" className="text-xs text-text-muted hover:text-text-primary transition-colors">跨视角对比</Link></li>
              <li><a href="https://github.com/qiangzhang2009/prismatic" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1">
                <Github className="w-3 h-3" /> GitHub
              </a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-3">法律</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-xs text-text-muted hover:text-text-primary transition-colors">使用条款</Link></li>
              <li><Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary transition-colors">隐私政策</Link></li>
              <li><Link href="/contact" className="text-xs text-text-muted hover:text-text-primary transition-colors">联系我们</Link></li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="border-t border-border-subtle pt-6 mb-6">
          <div className="bg-bg-elevated rounded-xl p-4 mb-4">
            <h4 className="text-xs font-medium text-text-secondary mb-2">免责声明</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              <strong className="text-text-secondary">重要提示：</strong>
              Prismatic 的人物对话功能基于公开文献和资料进行「认知蒸馏」，生成的回复代表的是对特定人物思维方式的分析和重构，
              并不意味着这些人物认同或支持平台上的任何观点、内容或建议。
              所有输出仅供学习和参考用途，不构成任何形式的投资建议、医疗建议、法律建议或其他专业建议。
              用户应自行判断内容的适用性，并对使用本平台产生的结果承担全部责任。
              本平台不保证内容的准确性、完整性或时效性。
            </p>
          </div>
          <div className="bg-bg-elevated rounded-xl p-4">
            <h4 className="text-xs font-medium text-text-secondary mb-2">AI 使用说明</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              本平台使用大语言模型（LLM）技术生成回复。AI 生成的内容可能包含不准确、虚构或过时的信息。
              我们鼓励用户批判性地对待所有 AI 输出，并结合独立研究和专业意见做出决策。
              涉及重要决策时，请咨询相关领域的专业人士。
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border-subtle">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-xs text-text-muted">
              &copy; {year} 上海张小强企业咨询事务所 版权所有
            </p>
            <p className="text-xs text-text-muted">
              微信公众号/视频号: 张小强出海
            </p>
          </div>
          <p className="text-xs text-text-muted">
            Made with curiosity & conviction
          </p>
        </div>
      </div>
    </footer>
  );
}
