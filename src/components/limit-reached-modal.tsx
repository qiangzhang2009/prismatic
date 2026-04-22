'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, KeyRound } from 'lucide-react';

export type LimitModalType = 'daily_limit' | 'api_key_required' | 'credits_exhausted';

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
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
              {/* ── Header ─────────────────────────────── */}
              <div className="relative px-6 pt-6 pb-4">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-bg-surface hover:bg-bg-overlay flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                    type === 'credits_exhausted' ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
                    : type === 'api_key_required' ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                    : 'bg-gradient-to-br from-amber-500/20 to-red-500/20'
                  }`}>
                    {type === 'api_key_required' ? (
                      <KeyRound className="w-7 h-7 text-blue-400" />
                    ) : (
                      <Zap className="w-7 h-7 text-amber-400" />
                    )}
                  </div>

                  {type === 'daily_limit' && (
                    <>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">
                        今日免费次数已用完
                      </h2>
                      <p className="text-sm text-text-secondary">
                        每天 10 次免费对话额度已耗尽，明天自动刷新
                      </p>
                    </>
                  )}

                  {type === 'credits_exhausted' && (
                    <>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">
                        充值条数已用完
                      </h2>
                      <p className="text-sm text-text-secondary">
                        充值条数已耗尽，可选择继续充值或等待明日免费次数刷新
                      </p>
                    </>
                  )}

                  {type === 'api_key_required' && (
                    <>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">需要设置 API Key</h2>
                      <p className="text-sm text-text-secondary">
                        使用你自己的 API Key 可零成本继续对话，或充值条数
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="h-px bg-border-subtle" />

              {/* ── Body ───────────────────────────────── */}
              <div className="px-6 py-5">

                {/* 每日免费次数用完：充值条数 + 订阅套餐 */}
                {type === 'daily_limit' && (
                  <>
                    {/* 充值条数入口 */}
                    <p className="text-xs font-medium text-text-secondary mb-3">充值问答条数（永久有效）</p>
                    <div className="space-y-2 mb-5">
                      {[
                        { name: '尝鲜包', credits: '200条', price: '¥9' },
                        { name: '标准包', credits: '600条', price: '¥25' },
                        { name: '增强包', credits: '1500条', price: '¥59' },
                      ].map(item => (
                        <button
                          key={item.name}
                          onClick={() => { window.location.href = 'weixin://'; }}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-prism-blue" />
                            <span className="text-sm font-medium text-text-primary">{item.name}</span>
                            <span className="text-xs text-text-muted">{item.credits}</span>
                          </div>
                          <span className="text-sm font-bold text-prism-blue">{item.price}</span>
                        </button>
                      ))}
                    </div>

                    {/* 说明文字 */}
                    <div className="p-3 rounded-xl bg-bg-surface border border-border-subtle mb-4">
                      <p className="text-xs text-text-muted leading-relaxed">
                        <span className="text-prism-blue font-medium">充值条数</span> 永久有效，不清零，不过期。
                        充值后<strong className="text-text-secondary">不消耗每日免费次数</strong>，两条通道独立使用。
                      </p>
                    </div>

                    <div className="flex justify-center mb-3">
                      <div className="p-2 bg-white rounded-xl shadow-lg">
                        <Image src="/wechat-qr.png" alt="微信二维码" width={100} height={100}
                          className="w-25 h-25 object-contain rounded-lg" unoptimized />
                      </div>
                    </div>
                    <p className="text-xs text-text-muted text-center">
                      微信搜索 <span className="font-mono font-medium text-text-secondary">3740977</span> 备注「Prismatic」
                    </p>
                  </>
                )}

                {/* 充值条数用完：只能继续充值 */}
                {type === 'credits_exhausted' && (
                  <>
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-4">
                      <p className="text-xs text-amber-400 leading-relaxed">
                        充值条数已耗尽，但每日仍有 10 次免费额度。充值条数永久有效，用完再买。
                      </p>
                    </div>

                    <p className="text-xs font-medium text-text-secondary mb-3">继续充值</p>
                    <div className="space-y-2 mb-5">
                      {[
                        { name: '尝鲜包', credits: '200条', price: '¥9' },
                        { name: '标准包', credits: '600条', price: '¥25' },
                        { name: '增强包', credits: '1500条', price: '¥59' },
                      ].map(item => (
                        <button
                          key={item.name}
                          onClick={() => { window.location.href = 'weixin://'; }}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-prism-blue" />
                            <span className="text-sm font-medium text-text-primary">{item.name}</span>
                            <span className="text-xs text-text-muted">{item.credits}</span>
                          </div>
                          <span className="text-sm font-bold text-prism-blue">{item.price}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center mb-3">
                      <div className="p-2 bg-white rounded-xl shadow-lg">
                        <Image src="/wechat-qr.png" alt="微信二维码" width={100} height={100}
                          className="w-25 h-25 object-contain rounded-lg" unoptimized />
                      </div>
                    </div>
                    <p className="text-xs text-text-muted text-center">
                      微信搜索 <span className="font-mono font-medium text-text-secondary">3740977</span> 备注「Prismatic」
                    </p>
                  </>
                )}

                {/* API Key 未设置 */}
                {type === 'api_key_required' && (
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
                      微信充值条数
                    </button>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white rounded-xl shadow-lg">
                        <Image src="/wechat-qr.png" alt="微信二维码" width={80} height={80}
                          className="w-20 h-20 object-contain rounded-lg" unoptimized />
                      </div>
                    </div>
                    <p className="text-xs text-text-muted text-center">
                      微信号：<span className="font-mono font-medium text-text-secondary">3740977</span>
                    </p>
                  </div>
                )}
              </div>

              {/* ── Footer ────────────────────────────── */}
              <div className="px-6 pb-6 space-y-2">
                {type === 'daily_limit' && (
                  <>
                    <Link href="/subscribe" onClick={onClose}
                      className="block w-full py-2.5 rounded-xl bg-prism-blue text-white font-medium text-center hover:opacity-90 transition-opacity text-sm">
                      查看完整会员权益
                    </Link>
                    <button onClick={onClose}
                      className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors">
                      我知道了
                    </button>
                  </>
                )}
                {type === 'credits_exhausted' && (
                  <button onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors">
                    我知道了
                  </button>
                )}
                {type === 'api_key_required' && (
                  <button onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors">
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
