'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';

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
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center mb-4">
                    <MessageCircle className="w-7 h-7 text-prism-blue" />
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary mb-1">
                    今日对话额度已用完
                  </h2>
                  <p className="text-sm text-text-secondary">
                    每位用户每天可对话 60 次
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border-subtle" />

              {/* Content */}
              <div className="px-6 py-5 text-center">
                <p className="text-sm text-text-muted mb-5 leading-relaxed">
                  需要更多对话次数？<br />
                  请联系作者开通更多额度
                </p>

                {/* WeChat QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="p-2 bg-white rounded-xl shadow-lg">
                    <Image
                      src="/wechat-qr.png"
                      alt="作者微信二维码"
                      width={160}
                      height={160}
                      className="w-40 h-40 object-contain rounded-lg"
                      unoptimized
                    />
                  </div>
                </div>

                <p className="text-xs text-text-muted">
                  扫码添加作者微信，备注「增加额度」
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
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
