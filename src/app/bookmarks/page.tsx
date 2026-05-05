'use client';

/**
 * User Bookmarks Page — /bookmarks
 * Shows the user's favorited personas with a toggle to remove.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Bookmark, Trash2, MessageSquare, Crown,
  Bot, Hexagon, Loader2, Shield, Check
} from 'lucide-react';
import { PERSONA_LIST, PERSONA_MAP } from '@/lib/personas';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

interface BookmarkEntry {
  slug: string;
  createdAt: string;
}

export default function BookmarksPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/user/bookmarks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchBookmarks();
  }, [user, fetchBookmarks]);

  const handleRemove = async (slug: string) => {
    setRemoving(slug);
    try {
      const res = await fetch(`/api/user/bookmarks?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setBookmarks(prev => prev.filter(b => b.slug !== slug));
      }
    } finally { setRemoving(null); }
  };

  const handleToggle = async (slug: string) => {
    if (removing) return;
    setRemoving(slug);
    try {
      const res = await fetch('/api/user/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.action === 'removed') {
          setBookmarks(prev => prev.filter(b => b.slug !== slug));
        }
      }
    } finally { setRemoving(null); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-prism-blue/20 to-prism-purple/20 flex items-center justify-center mx-auto">
            <Bookmark className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">登录后查看收藏</h2>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-6 py-2.5 rounded-xl bg-prism-gradient text-white text-sm font-medium"
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <Bookmark className="w-5 h-5 text-prism-blue" />
          <h1 className="font-display font-semibold text-text-primary">收藏人物</h1>
          <span className="text-sm text-text-muted ml-auto">
            {loading ? '' : `${bookmarks.length} 位`}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin mb-3" />
            <p className="text-sm text-text-muted">加载中...</p>
          </div>
        ) : bookmarks.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-bg-surface flex items-center justify-center mb-5 border border-border-subtle">
              <Bookmark className="w-10 h-10 text-text-muted/40" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">暂无收藏人物</h2>
            <p className="text-sm text-text-muted max-w-xs mb-6">
              在对话中点击人物卡片上的书签图标，即可收藏你喜欢的思想家
            </p>
            <button
              onClick={() => router.push('/personas')}
              className="px-5 py-2.5 rounded-xl bg-prism-gradient text-white text-sm font-medium"
            >
              浏览人物档案馆
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-text-primary">我的收藏</h2>
                <p className="text-xs text-text-muted mt-0.5">点击书签图标可取消收藏</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Bookmark className="w-3.5 h-3.5" />
                {bookmarks.length} 位人物
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              <AnimatePresence>
                {bookmarks.map((bookmark, idx) => {
                  const persona = PERSONA_MAP[bookmark.slug] ?? PERSONA_LIST.find(p => p.id === bookmark.slug);
                  if (!persona) return null;

                  const nameZh = (persona as any).nameZh ?? persona.name ?? bookmark.slug;
                  const gradientFrom = (persona as any).gradientFrom ?? '#6366f1';
                  const gradientTo = (persona as any).gradientTo ?? '#8b5cf6';
                  const accentColor = (persona as any).accentColor ?? '#6366f1';
                  const taglineZh = (persona as any).taglineZh ?? (persona as any).tagline ?? '';

                  return (
                    <motion.div
                      key={bookmark.slug}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                    >
                      <div className="group flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-bg-elevated hover:border-border-medium transition-all">
                        {/* Avatar */}
                        <div className="relative w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border-2"
                          style={{ borderColor: `${accentColor}40` }}>
                          {(persona as any).avatar ? (
                            <Image src={(persona as any).avatar} alt={nameZh} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold"
                              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
                              {nameZh.slice(0, 1)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{nameZh}</p>
                          {taglineZh && (
                            <p className="text-xs text-text-muted truncate mt-0.5">{taglineZh}</p>
                          )}
                          {bookmark.createdAt && (
                            <p className="text-[10px] text-text-muted/60 mt-1">
                              收藏于 {new Date(bookmark.createdAt).toLocaleDateString('zh-CN')}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Start chat */}
                          <button
                            onClick={() => router.push(`/?persona=${bookmark.slug}&mode=solo`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-prism-blue/10 text-prism-blue text-xs font-medium hover:bg-prism-blue/20 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            对话
                          </button>

                          {/* Remove bookmark */}
                          <button
                            onClick={() => handleToggle(bookmark.slug)}
                            disabled={removing === bookmark.slug}
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                              'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10',
                              removing === bookmark.slug && 'opacity-50 cursor-not-allowed'
                            )}
                            title="取消收藏"
                          >
                            {removing === bookmark.slug ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <div className="p-1 rounded bg-amber-400/20">
                                <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Hint */}
            <div className="mt-8 p-4 rounded-xl border border-border-subtle bg-bg-surface text-center">
              <p className="text-xs text-text-muted">
                想收藏更多人物？
                <button
                  onClick={() => router.push('/personas')}
                  className="text-prism-blue hover:underline ml-1"
                >
                  浏览人物档案馆 →
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
