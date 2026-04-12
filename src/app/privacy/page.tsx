/**
 * Prismatic — Privacy Policy
 */

import Link from 'next/link';
import { Hexagon, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-display font-bold mb-8">隐私政策</h1>

          <div className="prose prose-invert space-y-6 text-text-secondary">
            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">信息收集</h2>
              <p>我们仅收集为您提供服务所必需的信息，包括对话内容（用于AI多智能体协作分析）和基本账户信息。所有对话数据仅存储于我们的服务器，用于提供服务目的。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">数据使用</h2>
              <p>您的对话内容用于：生成多智能体协作响应、改进服务质量。我们不会将您的个人对话数据出售或提供给第三方广告商使用。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">数据安全</h2>
              <p>我们采用行业标准的安全措施保护您的数据。Vercel 托管环境提供了企业级的安全基础设施保障。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">第三方服务</h2>
              <p>我们使用大语言模型 API 处理您的对话内容以生成AI响应。所有对话数据均为一次性处理，不会被用于模型训练。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">联系我们</h2>
              <p>如有关于隐私政策的任何问题，请通过以下方式联系我们：</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>GitHub Issues: <a href="https://github.com/qiangzhang2009/prismatic" className="text-prism-blue hover:underline">https://github.com/qiangzhang2009/prismatic</a></li>
              </ul>
            </section>

            <p className="text-sm text-text-muted mt-8">最后更新：{new Date().toLocaleDateString('zh-CN')}</p>
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
