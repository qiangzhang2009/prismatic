'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Zap } from 'lucide-react';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LimitReachedModal({ isOpen, onClose }: LimitReachedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-bg-elevated border border-border-subtle shadow-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-bg-surface hover:bg-bg-overlay flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center mb-4">
                    <Zap className="w-7 h-7 text-amber-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary mb-1">
                    今日对话额度已用完
                  </h2>
                  <p className="text-sm text-text-secondary">
                    免费用户每天可对话 10 次，明天自动刷新
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border-subtle" />

              {/* Content */}
              <div className="px-6 py-5">
                <p className="text-sm text-text-muted mb-4 leading-relaxed text-center">
                  解锁无限对话额度，订阅会员计划
                </p>

                {/* Subscription options */}
                <div className="space-y-2 mb-5">
                  {[
                    { name: '月度订阅', price: '¥29/月', tag: '推荐', color: 'prism-blue' },
                    { name: '年度订阅', price: '¥199/年', tag: '最划算', color: 'green-500' },
                    { name: '终身会员', price: '¥399', tag: '永久', color: 'prism-purple' },
                  ].map(item => (
                    <button
                      key={item.name}
                      onClick={() => { window.location.href = 'weixin://'; }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-${item.color}/10 border border-${item.color}/20 hover:border-${item.color}/40 transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium text-${item.color}`}>{item.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${item.color}/15 text-${item.color}`}>{item.tag}</span>
                      </div>
                      <span className={`font-bold text-${item.color}`}>{item.price}</span>
                    </button>
                  ))}
                </div>

                {/* WeChat QR Code */}
                <div className="flex justify-center mb-3">
                  <div className="p-2 bg-white rounded-xl shadow-lg">
                    <Image
                      src="/wechat-qr.png"
                      alt="作者微信二维码"
                      width={120}
                      height={120}
                      className="w-30 h-30 object-contain rounded-lg"
                      unoptimized
                    />
                  </div>
                </div>

                <p className="text-xs text-text-muted text-center">
                  微信搜索 <span className="font-mono font-medium text-text-secondary">3740977</span> 备注「Prismatic会员」
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 space-y-2">
                <Link
                  href="/subscribe"
                  onClick={onClose}
                  className="block w-full py-2.5 rounded-xl bg-prism-blue text-white font-medium text-center hover:opacity-90 transition-opacity text-sm"
                >
                  查看完整会员权益
                </Link>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors"
                >
                  我知道了
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
