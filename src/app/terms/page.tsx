/**
 * Prismatic — Terms of Service
 */

import Link from 'next/link';
import { Hexagon, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
          <h1 className="text-3xl font-display font-bold mb-8">使用条款</h1>

          <div className="prose prose-invert space-y-6 text-text-secondary">
            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">服务说明</h2>
              <p>炼心阁 是一个AI多智能体协作平台，通过蒸馏人物（distilled personas）为您提供多角度思考和认知协作服务。平台汇聚多个人物视角的AI响应，帮助用户从不同维度分析问题。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">使用限制</h2>
              <p>您同意：</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>不将本服务用于任何违法或有害目的</li>
                <li>不尝试绕过任何安全措施或使用自动化工具滥用服务</li>
                <li>不对蒸馏人物进行商业化转售或重新分发</li>
                <li>遵守所有适用的法律法规</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">AI角色说明</h2>
              <p>炼心阁 中的蒸馏人物（distilled personas）是通过AI技术模拟的思维伙伴，并非真实人物本人。我们尽力确保其响应的准确性和可靠性，但不保证AI响应完全忠实于真实人物的思想。AI响应仅供参考学习使用。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">免责声明</h2>
              <p>炼心阁 及其开发者不对以下情况承担责任：</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>AI响应造成的任何直接或间接损失</li>
                <li>因服务中断造成的不便或数据丢失</li>
                <li>第三方链接内容或服务</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">开源许可</h2>
              <p>炼心阁 基于 MIT License 开源。您可以自由使用、修改和分发本项目，但需保留原始版权声明。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">服务变更</h2>
              <p>我们保留随时修改或终止服务的权利。重大变更将通过网站公告通知用户。</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">联系我们</h2>
              <p>如有关于使用条款的任何问题，请通过以下方式联系我们：</p>
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
            <span className="font-display font-semibold text-text-secondary">炼心阁</span>
          </div>
          <div className="text-sm text-text-muted">
            MIT License · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
