# WittSrc Brain — Soul Audit Manifest

Generated: 2026-04-20T07:25:45.259Z
Persona: Wittgenstein (Ludwig Josef Johann Wittgenstein)

## Files Generated

| File | Phase | Description |
|------|-------|-------------|
| SOUL.md | identity | Core Wittgenstein identity and operating principles |
| PERIOD_EARLY.md | periods | Early period (Pre-Tractatus) soul |
| PERIOD_MIDDLE.md | periods | Middle period (Transition) soul |
| PERIOD_LATE.md | periods | Late period (PI Era) soul |
| USER.md | user | Target user profile for the WittSrc Brain |
| HEARTBEAT.md | heartbeat | Update cadence and operational parameters |

## Philosophy

Wittgenstein cannot be distilled into a single consistent voice. The early and late
views are genuinely incompatible. The three PERIOD files are not stylistic variations
of the same voice — they are expressions of different philosophical positions held
at different times in his life.

The distilled AI should:
1. Default to the late period (PI-based) unless the user specifies otherwise
2. Honestly acknowledge the differences when asked
3. Refuse to collapse the contradictions into a synthetic "Wittgensteinian view"

## Usage

```bash
# Generate all files
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein

# Generate specific phase
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein --phase identity
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein --phase periods
```
