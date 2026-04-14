# Prismatic — Personas Data Dictionary

> For full data access and licensing: https://prismatic.zxqconsulting.com/contact

---

## Overview

The Prismatic platform's persona dataset is a **premium knowledge asset**. The full dataset is available through:

1. **Live deployment**: https://prismatic.zxqconsulting.com (no setup required)
2. **API access**: Contact for API credentials
3. **Dataset licensing**: Reach out for commercial or research licenses

The `src/lib/personas.ts` file in this repository contains the **public structure template** with documentation of the Persona data schema. To populate it with real data, follow the steps below.

---

## Persona Data Schema

Each persona in the dataset follows this TypeScript interface:

```typescript
interface Persona {
  id: string;                    // Unique ID: 'steve-jobs'
  slug: string;                  // URL slug: 'steve-jobs'
  name: string;                  // Full English name: 'Steve Jobs'
  nameZh: string;               // Chinese name: '史蒂夫·乔布斯'
  nameEn: string;               // English full name

  domain: Domain[];             // ['product', 'design', 'strategy']
  tagline: string;              // One-liner: 'Stay Hungry, Stay Foolish'
  taglineZh: string;            // Chinese: '保持饥饿，保持愚蠢'
  avatar: string;               // Avatar URL

  accentColor: string;          // Hex color: '#ff6b6b'
  gradientFrom: string;          // Gradient start: '#ff6b6b'
  gradientTo: string;            // Gradient end: '#ff9f43'

  brief: string;                // English summary
  briefZh: string;              // Chinese summary

  mentalModels: MentalModel[];        // 3-7 core thinking frameworks
  decisionHeuristics: DecisionHeuristic[]; // 5-10 decision rules
  expressionDNA: ExpressionDNA;       // Voice & language patterns
  values: Value[];                     // Value hierarchy
  antiPatterns: string[];              // Explicitly rejected behaviors
  tensions: Tension[];                 // Internal conflicts

  honestBoundaries: HonestBoundary[];   // What this persona CANNOT do
  strengths: string[];                 // Known strengths
  blindspots: string[];                 // Known blind spots

  sources: Source[];                    // Citations
  researchDate: string;                // '2024-01-15'
  version: string;                     // '1.0.0'

  researchDimensions: PersonaResearchDim[];
  systemPromptTemplate: string;
  identityPrompt: string;
}
```

### MentalModel

```typescript
interface MentalModel {
  id: string;
  name: string;
  nameZh: string;
  oneLiner: string;        // One-sentence description
  evidence: Evidence[];     // Source citations
  crossDomain: string[];   // Domains where this applies
  application: string;      // When to use
  limitation: string;       // When it fails
  generationPower: string;  // 'high' | 'medium' | 'low'
  exclusivity: string;       // 'unique to this persona' | 'shared'
}
```

### ExpressionDNA

```typescript
interface ExpressionDNA {
  sentenceStyle: string[];      // ['Declarative', 'Socratic questions']
  vocabulary: string[];          // ['focus', 'simplicity', 'vision']
  forbiddenWords: string[];      // Words this persona NEVER uses
  certaintyLevel: string;        // 'high' | 'medium' | 'low'
  toneShifts: number;
  humorStyle: string;
  rhetoricalHabit: string;
  chineseAdaptation?: string;    // Adaptation rules for Chinese
}
```

---

## Contributing New Personas

### Quality Standards

Before adding a new persona, ensure:

- [ ] At least **5 primary sources** (books, interviews, speeches)
- [ ] **3-7 mental models** with source citations
- [ ] **Expression DNA** with vocabulary fingerprint (min. 10 words)
- [ ] **Honest boundaries** explicitly defined
- [ ] **Legal review** for religious/public figures (see legal framework)

### Submission Process

1. Fork the repository
2. Create a persona draft following the schema above
3. Open a PR with `[PERSONA] ` prefix in the title
4. Include at minimum: 500-word brief, 3 mental models, expression DNA
5. Link to all source materials

---

*This document is part of the open-source project. The actual persona dataset is a separate commercial/research asset.*
