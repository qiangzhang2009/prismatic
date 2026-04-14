'use client';

/**
 * Renders chat message content with proper markdown support.
 * Handles both inline markdown and long-form structured content (Mission mode).
 */

import React, { Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MessageContentProps {
  content: string;
  role?: 'user' | 'agent' | 'system';
  className?: string;
}

/** Detect if content is a long structured Mission-style output */
function isStructuredOutput(content: string): boolean {
  const markers = ['📋', '✨', '🔍', '协作任务分解', '协作产出', '多元对话总结', '**【', '**• **'];
  return markers.some((m) => content.includes(m));
}

function StructuredOutput({ content }: { content: string }) {
  // Split by lines and render with visual hierarchy
  const lines = content.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Top-level header (e.g., "📋 协作任务分解")
        if (/^[📋✨🔍✅❌🧠💡🔬🎯⚡]+ /.test(trimmed)) {
          return (
            <p key={i} className="text-sm font-semibold text-prism-blue mt-2 mb-1 first:mt-0">
              {trimmed}
            </p>
          );
        }

        // Bold header with Chinese brackets: **【XXX】**
        if (/^\*\*【[^】]+】\*\*/.test(trimmed)) {
          return (
            <p key={i} className="text-sm font-semibold text-prism-amber mt-2 mb-0.5 first:mt-0">
              {trimmed.replace(/\*\*/g, '')}
            </p>
          );
        }

        // Bullet point with bold marker: • **something**: or - **something**:
        if (/^[•\-] \*\*/.test(trimmed) || /^\*\*•/.test(trimmed)) {
          const parts = trimmed
            .replace(/^[•\-]\s*/, '')
            .split(/(\*\*[^*]+\*\*)/);
          return (
            <p key={i} className="text-sm text-text-secondary pl-2 leading-relaxed">
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j} className="font-medium text-text-primary">{part.slice(2, -2)}</strong>;
                }
                return <Fragment key={j}>{part}</Fragment>;
              })}
            </p>
          );
        }

        // Sub-bullets (indented)
        if (/^  +[•\-]/.test(trimmed) || /^\s{2,}[^\s]/.test(trimmed)) {
          return (
            <p key={i} className="text-xs text-text-muted pl-5 leading-relaxed">
              {trimmed.replace(/\*\*/g, '')}
            </p>
          );
        }

        // Horizontal rule-ish separators
        if (/^[-=*_]{3,}$/.test(trimmed)) {
          return <div key={i} className="h-px bg-border-subtle my-2" />;
        }

        // Regular paragraph — render markdown inline
        return (
          <p key={i} className="text-sm text-text-secondary leading-relaxed">
            <ReactMarkdown>{trimmed}</ReactMarkdown>
          </p>
        );
      })}
    </div>
  );
}

export function MessageContent({ content, role, className }: MessageContentProps) {
  const isStructured = role === 'system' && isStructuredOutput(content);

  if (isStructured) {
    return (
      <div className={cn('text-sm', className)}>
        <StructuredOutput content={content} />
      </div>
    );
  }

  return (
    <div className={cn('prose-markdown text-sm', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
