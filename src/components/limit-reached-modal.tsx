'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Zap, KeyRound } from 'lucide-react';

export type LimitModalType = 'daily_limit' | 'api_key_required';

interface LimitReachedModalProps {
  isOpen: boolean;
  type?: LimitModalType;
  onClose: () => void;
  onSetApiKey?: () => void;
}

export function LimitReachedModal({ isOpen, type = 'daily_limit', onClose, onSetApiKey }: LimitReachedModalProps) {
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
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                    type === 'insufficient_credits' ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
                    : type === 'api_key_required' ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                    : 'bg-gradient-to-br from-amber-500/20 to-red-500/20'
                  }`}>
                    {type === 'api_key_required' ? (
                      <KeyRound className="w-7 h-7 text-blue-400" />
                    ) : (
                      <Zap className="w-7 h-7 text-amber-400" />
                    )}
                  </div>

                {type === 'api_key_required' && (
                    <>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">需要设置 API Key</h2>
                      <p className="text-sm text-text-secondary">
                        使用你自己的 API Key 可零成本继续对话，或充值积分
                      </p>
                    </>
                  )}

                  {type === 'daily_limit' && (
                    <>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">
                        今日对话额度已用完
                      </h2>
                      <p className="text-sm text-text-secondary">
                        免费用户每天可对话 10 次，明天自动刷新
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border-subtle" />

              {/* Content */}
              <div className="px-6 py-5">
                {type === 'daily_limit' && (
                  <>
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
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay transition-colors ${
                            item.color === 'prism-blue' ? 'border border-prism-blue/30' :
                            item.color === 'green-500' ? 'border border-green-500/30' :
                            'border border-prism-purple/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              item.color === 'prism-blue' ? 'text-prism-blue' :
                              item.color === 'green-500' ? 'text-green-400' : 'text-prism-purple'
                            }`}>{item.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              item.color === 'prism-blue' ? 'bg-prism-blue/15 text-prism-blue' :
                              item.color === 'green-500' ? 'bg-green-500/15 text-green-400' :
                              'bg-prism-purple/15 text-prism-purple'
                            }`}>{item.tag}</span>
                          </div>
                          <span className={`font-bold ${
                            item.color === 'prism-blue' ? 'text-prism-blue' :
                            item.color === 'green-500' ? 'text-green-400' : 'text-prism-purple'
                          }`}>{item.price}</span>
                        </button>
                      ))}
                    </div>

                    {/* WeChat QR */}
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
                  </>
                )}

                {type === 'api_key_required' && (
                  <>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={onSetApiKey}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                        设置 API Key（零平台成本）
                      </button>
                      <button
                        onClick={() => { window.location.href = 'weixin://'; }}
                        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors"
                      >
                        微信充值积分
                      </button>
                      <div className="flex justify-center">
                        <div className="p-2 bg-white rounded-xl shadow-lg">
                          <Image
                            src="/wechat-qr.png"
                            alt="微信二维码"
                            width={80}
                            height={80}
                            className="w-20 h-20 object-contain rounded-lg"
                            unoptimized
                          />
                        </div>
                      </div>
                      <p className="text-xs text-text-muted text-center">
                        微信号：<span className="font-mono font-medium text-text-secondary">3740977</span>
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 space-y-2">
                {type === 'daily_limit' && (
                  <>
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
                  </>
                )}
                {type === 'api_key_required' && (
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors"
                  >
                    稍后再说
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
