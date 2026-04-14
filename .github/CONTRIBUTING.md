# Contributing to Prismatic · 棱镜折射

Thank you for your interest in contributing to Prismatic! This document provides guidelines and instructions for contributing.

---

## Quick Links

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Persona Contribution Guide](#persona-contribution-guide)

---

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold a respectful, constructive, and inclusive environment.

---

## Ways to Contribute

### 🐛 Reporting Bugs

Open a [Bug Report](https://github.com/qiangzhang2009/prismatic/issues/new?template=bug_report.yml) with:
- Clear description of the bug
- Steps to reproduce
- Expected vs. actual behavior
- Environment (browser, OS, etc.)

### 💡 Feature Requests

Open a [Feature Request](https://github.com/qiangzhang2009/prismatic/issues/new?template=feature_request.yml) with:
- Clear problem or use case
- Proposed solution
- Any relevant context or mockups

### 🔧 Code Contributions

- Fix bugs
- Improve documentation
- Add new features
- Optimize performance
- Improve test coverage

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/prismatic.git
cd prismatic

# 2. Install dependencies
npm install

# 3. Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix

# 4. Make your changes
# ... write code ...

# 5. Run type check and lint
npm run type-check
npm run lint

# 6. Run build to ensure everything compiles
npm run build

# 7. Run tests (if any)
npm test
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required variables for local development:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or `DEEPSEEK_API_KEY` — LLM provider key

> Note: Development mode uses mock email codes printed to console — no real SMS/email config needed for local dev.

---

## Pull Request Process

### Before Submitting

1. **Check existing PRs** — avoid duplicate work
2. **Run all checks** — `npm run type-check && npm run lint && npm run build`
3. **Write meaningful commit messages** — follow conventional commits
4. **Keep PRs focused** — one feature or fix per PR

### PR Title Format

```
<type>: <short description>

Types:
- feat:     New feature
- fix:      Bug fix
- docs:     Documentation changes
- refactor: Code refactoring
- perf:     Performance improvements
- chore:    Build system / dependencies
```

Examples:
```
feat: add Prism View multi-agent collaboration mode
fix: resolve guardian scheduling race condition
docs: update deployment guide with Vercel instructions
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Change 1
- Change 2

## Test Plan
How was this tested?

## Screenshots (if UI changes)
Before/after screenshots or recordings.
```

---

## Persona Contribution Guide

> ⚠️ **Note**: `src/lib/personas.ts` is a licensed dataset (not in the public repository). 
> If you want to contribute a new Persona, please follow this guide and submit a PR with your distillation draft.

### Quality Standards

A high-quality Persona submission includes:

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Mental Models | 3 | 5–7 |
| Decision Heuristics | 5 | 8–15 |
| Expression DNA | vocabulary + sentence style | + forbidden words + humor style |
| Source Citations | 3 primary sources | 5+ with URLs |
| Expression DNA | basic | full with Chinese adaptation |

### Submission Steps

1. Fork the repository
2. Study the [Methodology](https://prismatic.zxqconsulting.com/methodology)
3. Review `PERSONAS_DATA_EXAMPLE.md` for the full schema
4. Create a branch: `git checkout -b persona/your-persona-name`
5. Add your Persona following the schema
6. Run `npm run type-check` to validate
7. Submit a PR with `[PERSONA] ` prefix

### Persona PR Requirements

```markdown
## Persona Submission: [Persona Name]

### Brief (500+ characters)
[Your brief description in Chinese]

### Mental Models
1. [Name] — [One-line description]
   - Application: [When to use]
   - Limitation: [When it fails]

### Expression DNA
- Vocabulary: [10+ characteristic words]
- Sentence Style: [2-3 styles]
- Forbidden Words: [5+ words this persona never uses]

### Sources
- [Source 1] ([URL if available])
- [Source 2] ([URL if available])
```

---

## Security Disclosures

If you discover a security vulnerability, please do NOT open a public issue. 
Instead, contact the maintainers directly.

---

## Questions?

Feel free to open a Discussion or reach out through the project page.

Thank you for contributing! 🙏
