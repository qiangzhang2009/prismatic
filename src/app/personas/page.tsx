/**
 * Prismatic — Personas Library Page
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import { PERSONA_LIST, getPersonasByDomain } from '@/lib/personas';
import { PersonaCard } from '@/components/persona-card';
import { cn } from '@/lib/utils';
import type { Domain } from '@/lib/types';
import { MODES, DOMAINS } from '@/lib/constants';

export default function PersonasPage() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const domains = Array.from(new Set(PERSONA_LIST.flatMap((p) => p.domain))) as Domain[];

  const filtered = PERSONA_LIST.filter((p) => {
    const matchesDomain = selectedDomain === 'all' || p.domain.includes(selectedDomain);
    const matchesSearch =
      !searchQuery ||
      p.nameZh.includes(searchQuery) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.taglineZh.includes(searchQuery) ||
      p.briefZh.includes(searchQuery);
    return matchesDomain && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <h1 className="font-display font-semibold">人物档案馆</h1>
          <span className="text-text-muted text-sm ml-auto">{PERSONA_LIST.length}位人物</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索人物..."
              className="input-prismatic pl-10"
            />
          </div>

          {/* Domain filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                selectedDomain === 'all'
                  ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                  : 'text-text-secondary hover:text-text-primary border border-border-subtle'
              )}
              onClick={() => setSelectedDomain('all')}
            >
              全部
            </button>
            {domains.map((d) => (
              <button
                key={d}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  selectedDomain === d
                    ? 'bg-prism-blue/20 text-prism-blue border border-prism-blue/30'
                    : 'text-text-secondary hover:text-text-primary border border-border-subtle'
                )}
                onClick={() => setSelectedDomain(d)}
              >
                {DOMAINS[d as keyof typeof DOMAINS]?.label ?? d}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((persona, i) => (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <PersonaCard persona={persona} />
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-text-muted">没有找到匹配的人物</p>
          </div>
        )}
      </div>
    </div>
  );
}
