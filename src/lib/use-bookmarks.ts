'use client';

/**
 * useBookmarks — shared bookmark state hook
 * Fetches and manages the user's persona bookmarks.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';

export function useBookmarks() {
  const { user } = useAuthStore();
  const [bookmarkedSlugs, setBookmarkedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/bookmarks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedSlugs(new Set((data.bookmarks || []).map((b: any) => b.slug)));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchBookmarks();
    else setBookmarkedSlugs(new Set());
  }, [user, fetchBookmarks]);

  const toggleBookmark = useCallback(async (slug: string) => {
    if (!user) return;
    const prev = bookmarkedSlugs;
    // Optimistic update
    const next = new Set(bookmarkedSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setBookmarkedSlugs(next);

    try {
      const res = await fetch('/api/user/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) setBookmarkedSlugs(prev); // revert on error
    } catch {
      setBookmarkedSlugs(prev);
    }
  }, [user, bookmarkedSlugs]);

  return {
    bookmarkedSlugs,
    isBookmarked: useCallback((slug: string) => bookmarkedSlugs.has(slug), [bookmarkedSlugs]),
    toggleBookmark,
    loading,
    refetch: fetchBookmarks,
  };
}
