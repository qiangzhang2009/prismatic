# WittSrc Brain Heartbeat

## Update Cadence

| Frequency | Action |
|-----------|--------|
| **Daily** | Minions cron: sync WittSrc/Clarino updates, extract new links |
| **Weekly** | Maintenance check: orphans, dead links, stale pages |
| **Monthly** | Enrichment pass: Tier 1 entities get full update |
| **Quarterly** | Full soul-audit review: do we need a new PERIOD.md? |

## Brain Stats (initialized)

- Brain pages: ~182 (175 works + 7 concepts + SEP/IEP articles)
- Corpus size: ~7,257,660 words (WittSrc BNE + Clarino-CC + Gutenberg)
- Total chunks: 16,268
- Graph edges: 1,580 (cites: 1347, evolves_to: 138, contradicts: 71, influenced_by: 11)
- Entity count: 44,000+ extracted
- Last import: 2026-04-20
- Graph edges: 1,580 links extracted

## Alert Thresholds

| Condition | Severity | Action |
|-----------|----------|--------|
| WittSrc publishes new manuscript | High | Trigger ingest |
| New SEP Wittgenstein article | Medium | Trigger enrich |
| Dead link count > 5 | Medium | Alert + fix |
| Orphan concept pages > 10 | Low | Review |
| Brain page count drops | High | Investigate |

## Persona Version

- Initial version: 1.0.0 (2026-04-20)
- Based on: WITTSRC BNE + CLARINO/WAB CC + Gutenberg
- Coverage: 98.1% of Nachlass

## Distillation Pipeline Integration

This brain feeds into the Prismatic distillation pipeline:

1. **Step 1** (Research): Brain provides searchable knowledge for research phase
2. **Step 2** (Mental Models): Graph queries reveal concept evolution
3. **Step 3** (Expression DNA): Corpus provides text for voice analysis
4. **Step 5** (Blind Testing): Hybrid search enables automated Q&A comparison
5. **Step 6** (Iteration): Brain updates with new corpus material
