'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PERSONA_LIST } from '@/lib/personas';

interface Persona {
  slug: string;
  nameZh: string;
  name: string;
  taglineZh: string;
  gradientFrom: string;
  gradientTo: string;
}

interface MentionPickerProps {
  /** Current textarea value */
  value: string;
  /** Cursor position in the textarea */
  caretPos: number;
  /** Called when user selects a persona to mention */
  onSelect: (personaSlug: string, displayName: string) => void;
  /** Called when picker should close */
  onClose: () => void;
  /** Position of the textarea (for placing the dropdown) */
  textareaRect?: DOMRect | null;
}

/** Filtered & sorted persona candidates for the mention dropdown */
function getCandidates(query: string): Persona[] {
  if (!query) {
    // No query: show popular/featured personas first, then alphabetically
    return PERSONA_LIST
      .filter(p => p.nameZh && p.slug)
      .slice(0, 12);
  }
  const q = query.toLowerCase();
  return PERSONA_LIST
    .filter(p => {
      if (!p.nameZh || !p.slug) return false;
      return (
        p.nameZh.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.taglineZh?.includes(q) ||
        false
      );
    })
    .slice(0, 8);
}

export default function MentionPicker({
  value,
  caretPos,
  onSelect,
  onClose,
  textareaRect,
}: MentionPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Extract the text after the last @ up to cursor
  const getQueryAfterAt = useCallback(() => {
    const textBefore = value.slice(0, caretPos);
    const match = textBefore.match(/@([^@\s]{0,30})$/);
    return match ? match[1] : '';
  }, [value, caretPos]);

  useEffect(() => {
    setQuery(getQueryAfterAt());
    setSelectedIdx(0);
  }, [getQueryAfterAt]);

  const candidates = getCandidates(query);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, candidates.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (candidates.length > 0) {
          e.preventDefault();
          const p = candidates[selectedIdx];
          onSelect(p.slug, `@${p.nameZh} `);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [candidates, selectedIdx, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIdx] as HTMLElement;
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (candidates.length === 0 && query.length > 0) return null;

  // Position the dropdown below the textarea, aligned to the left edge
  const style: React.CSSProperties = textareaRect
    ? {
        position: 'fixed',
        top: textareaRect.bottom + 4,
        left: textareaRect.left,
        zIndex: 9999,
      }
    : {
        position: 'absolute',
        bottom: '100%',
        left: 0,
        zIndex: 9999,
      };

  return (
    <div
      style={style}
      className="w-80 max-h-80 overflow-y-auto rounded-xl border border-white/15 bg-bg-overlay/95 backdrop-blur-xl shadow-2xl"
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-white/10 flex items-center gap-2 sticky top-0 bg-bg-overlay/95">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
          {query ? `搜索: ${query}` : '推荐人物'}
        </span>
        <span className="ml-auto text-[10px] text-text-muted/50">↑↓ 选择 · Enter 插入</span>
      </div>

      {/* List */}
      <div ref={listRef} className="py-1">
        {candidates.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            onMouseEnter={() => setSelectedIdx(i)}
            onClick={() => onSelect(p.slug, `@${p.nameZh} `)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              i === selectedIdx ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
              }}
            >
              {p.nameZh.slice(0, 2)}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{p.nameZh}</div>
              {p.taglineZh && (
                <div className="text-[10px] text-text-muted truncate">{p.taglineZh}</div>
              )}
            </div>
            {/* Select indicator */}
            {i === selectedIdx && (
              <div className="text-[10px] text-prism-blue/80 flex-shrink-0">⇥</div>
            )}
          </button>
        ))}

        {candidates.length === 0 && query.length > 0 && (
          <div className="px-3 py-4 text-center text-xs text-text-muted">
            未找到 &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-white/10 text-[10px] text-text-muted/60 text-center">
        点击人物插入 @{query || '...' } · Esc 关闭
      </div>
    </div>
  );
}
