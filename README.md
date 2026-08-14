# Transformation PMO — Signal Engine

**Signal-driven executive cadence for procurement & supply chain transformation programs.**

Built on the same evaluator/signal-cascade architecture as Truetempo (margin intelligence for PS delivery), retargeted at enterprise procurement savings pipelines.

---

## Quick Start

No build step. Open `index.html` in a browser or serve statically.

```bash
npx serve .
```

## Architecture

```
transformation/
├── core/        ← Signal cascade, dedup, honest-degradation
├── domains/     ← Procurement signal bundle (7 evaluators)
├── models/      ← InitiativeStore, WorkstreamStore
├── adapters/    ← Asana field mapping, CSV import
├── views/       ← Dashboard, heatmap, pipeline, ELT export
├── config/      ← Persistence, auth
├── data/        ← Demo fixtures (synthetic)
├── styles/      ← CSS tokens (shared design system)
└── tests/       ← Test suites
```

## Stack

- Vanilla JS (ES modules) — zero build step
- Static hosting (Amplify)
- Lambda + API Gateway (persistence, Asana sync)
- S3 JSON store
- Cognito auth

## Status

Scaffolded — Phase 1 build in progress.
