# WittSrc Brain — Skill Pack Reference

> WittSrc Brain is a specialized skill pack for the gbrain architecture.
> It adapts the general-purpose gbrain skills (brain-ops, ingest, enrich, query, etc.)
> to the Wittgenstein Nachlass corpus.

## Skill Directory

```
skills/wittsrc-brain/
├── SKILL.md                          # Main entry — overview, architecture, commands
├── RESOLVER.md                       # Skill routing table
├── ingest/
│   └── SKILL.md                      # Import Wittgenstein corpus → Brain Pages
├── link/
│   └── SKILL.md                      # Zero-LLM auto-link extraction
├── query/
│   └── SKILL.md                      # Hybrid search (vector + keyword + RRF)
├── graph/
│   └── SKILL.md                      # Knowledge graph traversal
├── timeline/
│   └── SKILL.md                      # Extract concept/work timelines
├── enrich/
│   └── SKILL.md                      # Tiered entity enrichment
├── maintain/
│   └── SKILL.md                      # Brain health checks
├── soul-audit/
│   └── SKILL.md                      # Wittgenstein identity configuration
└── conventions/
    ├── wittgenstein-links.md          # Link types + regex patterns
    └── philosophical-periods.md       # Early/Middle/Late period definitions
```

## Script Commands

```bash
# Import corpus → brain pages
bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstain/texts/

# Extract typed links → knowledge graph
bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstain/brain/

# Query the brain
bun run scripts/wittsrc-query.ts "What did Wittgenstein say about language games?"

# Graph traversal
bun run scripts/wittsrc-graph-query.ts work-ms-114 --type evolves_to --depth 3

# Timeline extraction
bun run scripts/wittsrc-timeline.ts --all --type concept

# Health check
bun run scripts/wittsrc-maintain.ts --check

# Soul audit (identity files)
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein

# Minions (automated cron jobs)
bun run scripts/wittsrc-minions.ts --list     # List all jobs
bun run scripts/wittsrc-minions.ts sync       # Run sync job
bun run scripts/wittsrc-minions.ts all         # Run all jobs
```

## Type Definitions

See `scripts/types/wittsrc-types.ts` for shared TypeScript types.
