'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Zap, Copy, CheckCheck } from 'lucide-react';

export type LimitModalType = 'daily_limit' | 'api_key_required' | 'credits_exhausted';

interface LimitReachedModalProps {
  isOpen: boolean;
  type?: LimitModalType;
  onClose: () => void;
  onSetApiKey?: () => void;
}

function MiniPaymentModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText('3740977');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-xs rounded-2xl border border-border-subtle bg-bg-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">扫码支付</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative w-44 h-44 rounded-xl overflow-hidden border border-border-subtle bg-bg-surface mb-3">
            <Image src="/wechat-payment-1.png" alt="微信收款码" fill className="object-cover" unoptimized />
          </div>
          <p className="text-xs text-text-secondary mb-3">打开微信，扫描上方二维码付款</p>
          <div className="w-full flex items-center justify-between rounded-lg bg-bg-surface border border-border-subtle px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-green-500/15 flex items-center justify-center">
                <span className="text-green-400 font-bold text-[10px]">微</span>
              </div>
              <span className="text-xs text-text-secondary font-mono">3740977</span>
            </div>
            <button onClick={handleCopy} className="text-[10px] text-prism-blue">
              {copied ? <><CheckCheck className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
            </button>
          </div>
          <p className="text-[10px] text-text-muted text-center">
            备注「Prismatic」，付款后联系
            <span className="font-mono">3740977</span> 开通服务
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LimitReachedModal({ isOpen, type = 'daily_limit', onClose, onSetApiKey }: LimitReachedModalProps) {
  const [showPayment, setShowPayment] = useState(false);
  const showPointsExhausted = type !== 'api_key_required';

  return (
    <>
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
                <div className="relative px-6 pt-6 pb-4">
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-7 h-7 rounded-full bg-bg-surface hover:bg-bg-overlay flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                      <Zap className="w-7 h-7 text-amber-400" />
                    </div>

                    {showPointsExhausted ? (
                      <>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">
                          积分不足
                        </h2>
                        <p className="text-sm text-text-secondary">
                          今日积分已耗尽，明天凌晨自动刷新 20 积分
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">
                          需要设置 API Key
                        </h2>
                        <p className="text-sm text-text-secondary">
                          使用你自己的 API Key 可零成本继续对话，或充值积分
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border-subtle" />

                <div className="px-6 py-5">
                  {showPointsExhausted ? (
                    <>
                      <p className="text-xs font-medium text-text-secondary mb-3">立即充值（永久有效）</p>
                      <div className="space-y-2 mb-5">
                        {[
                          { name: '尝鲜包', credits: '200积分', price: '¥9' },
                          { name: '标准包', credits: '600积分', price: '¥25' },
                          { name: '增强包', credits: '1500积分', price: '¥59' },
                        ].map((item) => (
                          <button
                            key={item.name}
                            onClick={() => { onClose(); setShowPayment(true); }}
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

                      <div className="p-3 rounded-xl bg-bg-surface border border-border-subtle mb-4">
                        <p className="text-xs text-text-muted leading-relaxed">
                          充值积分 <span className="text-prism-blue font-medium">永久有效</span>，
                          不清零，不过期，打通全站所有 AI 互动。
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {onSetApiKey && (
                        <button
                          onClick={onSetApiKey}
                          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          设置 API Key（零平台成本）
                        </button>
                      )}
                      <p className="text-xs font-medium text-text-secondary mb-2">充值积分（永久有效）</p>
                      <div className="space-y-2 mb-4">
                        {[
                          { name: '尝鲜包', credits: '200积分', price: '¥9' },
                          { name: '标准包', credits: '600积分', price: '¥25' },
                        ].map((item) => (
                          <button
                            key={item.name}
                            onClick={() => { onClose(); setShowPayment(true); }}
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
                    </div>
                  )}

                  <div className="flex justify-center mb-3">
                    <div className="p-2 bg-white rounded-xl shadow-lg">
                      <Image src="/wechat-qr.png" alt="微信二维码" width={100} height={100}
                        className="w-25 h-25 object-contain rounded-lg" unoptimized />
                    </div>
                  </div>
                  <p className="text-xs text-text-muted text-center">
                    微信搜索 <span className="font-mono font-medium text-text-secondary">3740977</span> 备注「Prismatic」
                  </p>
                </div>

                <div className="px-6 pb-6 space-y-2">
                  <button onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-bg-surface hover:bg-bg-overlay text-text-secondary text-sm transition-colors">
                    {showPointsExhausted ? '明天再来' : '稍后再说'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPayment && <MiniPaymentModal onClose={() => setShowPayment(false)} />}
      </AnimatePresence>
    </>
  );
}
