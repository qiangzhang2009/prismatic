/**
 * Prismatic — Contact Us
 */

import Link from 'next/link';
import { Hexagon, ArrowLeft, Github, MessageCircle } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>返回首页</span>
          </Link>
        </div>
      </header>

      <main className="pt-16 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-4">联系我们</h1>
          <p className="text-text-secondary mb-12">我们很乐意听取您的意见、建议或问题反馈。</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a
              href="https://github.com/qiangzhang2009/prismatic"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl p-6 border border-border-subtle bg-bg-surface hover:border-border-medium transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Github className="w-6 h-6 text-text-secondary" />
              </div>
              <h2 className="font-semibold mb-2">GitHub Issues</h2>
              <p className="text-sm text-text-secondary">提交 Bug 报告、功能请求，或参与开源贡献</p>
              <span className="inline-flex items-center gap-1 mt-3 text-sm text-prism-blue">
                github.com/qiangzhang2009/prismatic <ArrowLeft className="w-3 h-3 rotate-180" />
              </span>
            </a>

            <div className="rounded-2xl p-6 border border-border-subtle bg-bg-surface">
              <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-text-secondary" />
              </div>
              <h2 className="font-semibold mb-2">社区反馈</h2>
              <p className="text-sm text-text-secondary mb-3">对蒸馏人物的准确性、表达风格有任何建议，欢迎反馈</p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl p-8 border border-border-subtle bg-bg-surface">
            <h2 className="font-semibold mb-4">关于 Prismatic</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Prismatic 是一个开源的AI多智能体协作平台，致力于将人类卓越思维家的心智模型和决策方法论进行科学蒸馏，
              为用户提供多维度的认知协作体验。项目基于 MIT License 开源，欢迎各界贡献者参与。
            </p>
            <div className="mt-4 flex items-center gap-6 text-sm text-text-muted">
              <span>33+ 蒸馏人物</span>
              <span>4 种协作模式</span>
              <span>100+ 心智模型</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-secondary">Prismatic</span>
          </div>
          <div className="text-sm text-text-muted">
            MIT License · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
