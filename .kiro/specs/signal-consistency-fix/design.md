# Technical Design Document

## Overview

This is a hardening pass on top of `mvp-completion`, not a rebuild. It touches five files' worth of behavior: one bug fix (initiative RAG), one net-new evaluator plus a new engine capability (owner concentration / portfolio pass), one security fix (CORS), one coverage gap (Lambda tests), and one config fix (Amplify artifacts). Nothing in `core/signal-cascade.js`'s existing per-initiative behavior, `domains/procurement-bundle.js`'s six existing evaluators, or any already-correct view logic changes.

Reference: `#[[transform.md]]`, `#[[requirements.md]]` (this spec)

## Architecture Delta

```
core/signal-cascade.js
  runSignals(initiatives, bundle, options)         ← unchanged
  runPortfolioSignals(initiatives, signals, ...)    ← NEW: Portfolio_Pass entry point

domains/
  procurement-bundle.js                             ← unchanged (still 6 initiative-level evaluators)
  program-bundle.js                                 ← NEW: portfolio-level evaluators (owner-concentration)

views/view-manager.js
  deriveInitiativeRag(initiativeId, signals)         ← NEW: shared utility, single source of truth

views/pipeline-view.js                               ← reads init.rag → reads deriveInitiativeRag(...)
data/demo-fixtures.js                                ← rag field removed from all 13 initiatives + 7 workstreams

lambda/*.js                                           ← CORS_HEADERS becomes corsHeaders(), origin from env
tests/lambda-*.test.js                                ← NEW: 3 files, mocked S3Client.prototype.send
amplify.yml                                            ← 'lambda/**/*' removed from artifacts.files
```

## Components and Interfaces

### 1. Portfolio Pass (`core/signal-cascade.js`)

```javascript
// Public API — new export alongside existing runSignals()
export function runPortfolioSignals(initiatives, signals, portfolioBundle, options = {})
```

**Behavior:**
1. Build `ctx = { initiatives, signals, asOfDate: options.asOfDate }`.
2. Run every evaluator in `portfolioBundle.evaluators` against `ctx` and `portfolioBundle.thresholds`, same try/catch isolation `runSignals()` already uses per evaluator.
3. Concatenate the resulting signals with the per-initiative `signals` array passed in.
4. Apply the *same* two-pass dedup `runSignals()` already implements (Pass 1 exact `id:initiativeId`, Pass 2 0.72 consequence similarity) — portfolio-level signals use `initiativeId: null`, so they never collide with per-initiative signals on Pass 1, and Pass 2's per-initiative-id scoping is relaxed to allow portfolio signals to be compared against each other only (not against per-initiative signals, which are about a different subject).
5. Return the merged, deduped, priority-sorted signal array — this is what `app.js` passes into `initViews()`.

**Caller change in `app.js`:**
```javascript
const initiativeSignals = runSignals(InitiativeStore.getAll(), ProcurementBundle, { asOfDate });
const signals = runPortfolioSignals(InitiativeStore.getAll(), initiativeSignals, ProgramBundle, { asOfDate });
```

### 2. Program Bundle (`domains/program-bundle.js`) — NEW FILE

```javascript
const thresholds = {
  ownerConcentrationCount: 2,   // # of at-risk initiatives before flagging
  atRiskPriority: 2,            // signals at this priority or better count as "at-risk"
};

const evaluators = [
  {
    id: 'owner-concentration',
    evaluate(ctx, thr) {
      const { initiatives, signals } = ctx;
      const atRiskIdsByOwner = new Map();

      for (const sig of signals) {
        if (sig.priority > thr.atRiskPriority || !sig.initiativeId) continue;
        const init = initiatives.find(i => i.id === sig.initiativeId);
        if (!init) continue;
        if (!atRiskIdsByOwner.has(init.owner)) atRiskIdsByOwner.set(init.owner, new Set());
        atRiskIdsByOwner.get(init.owner).add(init.id);
      }

      const out = [];
      for (const [owner, ids] of atRiskIdsByOwner) {
        if (ids.size < thr.ownerConcentrationCount) continue;
        const exposure = initiatives
          .filter(i => ids.has(i.id))
          .reduce((sum, i) => sum + (i.savings?.target || 0), 0);

        out.push({
          priority: 4,
          id: 'owner-concentration',
          initiativeId: null,
          title: `Owner concentration risk — ${owner}`,
          consequence: `${owner} owns ${ids.size} at-risk initiatives totaling $${(exposure / 1e6).toFixed(1)}M of pipeline exposure.`,
          action: `Review capacity with ${owner} or reassign one workstream.`,
        });
      }
      return out;
    }
  }
];

const ProgramBundle = { thresholds, evaluators };
export default ProgramBundle;
```

This mirrors `procurement-bundle.js`'s existing plain-object evaluator shape exactly — no new evaluator contract, just a new `ctx` shape (`{ initiatives, signals }` instead of `{ initiative, settings, asOfDate }`) for evaluators that opt into portfolio scope.

### 3. Shared RAG Derivation (`views/view-manager.js`)

```javascript
// Public API — new export alongside formatMillions, formatPct, ragClass
export function deriveInitiativeRag(initiativeId, signals) {
  const own = signals.filter(s => s.initiativeId === initiativeId);
  if (own.some(s => s.priority === 1)) return 'r';
  if (own.some(s => s.priority === 2)) return 'a';
  return 'g';
}
```

Same shape as the already-correct `deriveWorkstreamRag()` in `heatmap-view.js` — this makes that pattern the one and only RAG derivation path in the app, reused by both views instead of duplicated.

**`views/pipeline-view.js` change:**
```diff
- const ragDotClass = init.rag ? `rag-dot ${init.rag}` : 'rag-dot g';
+ import { deriveInitiativeRag } from './view-manager.js';
+ const rag = deriveInitiativeRag(init.id, signals);
+ const ragDotClass = `rag-dot ${rag}`;
```

`renderPipeline(container, { initiatives, thresholds })` gains `signals` to its destructured context param — `view-manager.js`'s existing `context` object already includes `signals`, so this is a one-line addition to what `renderPipeline` reads, not a new plumbing path.

### 4. Data Model Correction

**Initiative Object — `rag` field removed:**
```diff
  {
    id: 'init-001',
    name: 'Steel/Alloy Supplier Consolidation',
    workstream: 'Direct Materials',
    owner: 'J. Alvarez',
    stage: 'implementing',
    savings: { baseline: 3200000, target: 3200000, validated: 2900000, realized: 1400000 },
    dueDate: '2026-10-15',
    asanaProjectId: 'proj_001',
    lastSyncedAt: '2026-08-12T10:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
-   rag: 'a',
    priorValidated: null,
  },
```

**Workstream Summary Object — `rag` field removed** (it was already unused; `heatmap-view.js` derives its own and ignores this field, but leaving it in the data model invites the next person to read it instead of deriving it, which is exactly how the Requirement 1 bug happened):
```diff
- { name: 'Direct Materials', target: 4.3, validated: 3.5, realized: 1.4, rag: 'a' },
+ { name: 'Direct Materials', target: 4.3, validated: 3.5, realized: 1.4 },
```

`view-manager.js`'s `_buildWorkstreams()` also drops its own `entry.rag` accumulation logic (the one reading `init.rag`, per the same rationale) — workstream RAG continues to come exclusively from `heatmap-view.js`'s `deriveWorkstreamRag()`, unchanged.

### 5. CORS Restriction (`lambda/read-initiatives.js`, `write-initiatives.js`, `sync-asana.js`)

```javascript
// New shared pattern, repeated identically in all three files
// (no shared lambda layer exists yet — see Notes in tasks.md)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://origin-not-configured.invalid';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS', // per-function: GET/PUT/POST as already defined
};
```

The fallback value is deliberately not a valid origin any browser will send — if `ALLOWED_ORIGIN` isn't set, CORS fails closed instead of silently reopening to `*`. `DEPLOYMENT.md` gets one new line in its Lambda Environment Variables table for `ALLOWED_ORIGIN` (the Amplify domain, e.g. `https://main.d1234abcde.amplifyapp.com`).

### 6. Lambda Integration Tests (`tests/lambda-read-initiatives.test.js`, `tests/lambda-write-initiatives.test.js`, `tests/lambda-sync-asana.test.js`)

Mocking approach: Node 20's `node:test` ships `t.mock.method()`, which can stub `S3Client.prototype.send` for the duration of a test without any new dependency or handler refactor:

```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { handler } from '../lambda/read-initiatives.js';

test('returns [] when S3 object does not exist', async (t) => {
  t.mock.method(S3Client.prototype, 'send', async () => {
    const err = new Error('not found');
    err.name = 'NoSuchKey';
    throw err;
  });

  const result = await handler({ httpMethod: 'GET' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), []);
});
```

Each of the three new test files covers exactly the scenarios listed in Requirement 4's acceptance criteria — no more, no less; these are integration tests for the handler's control flow, not a re-test of `AsanaAdapter` internals (already covered by `tests/asana-adapter.test.js`).

### 7. Amplify Artifact List (`amplify.yml`)

```diff
  artifacts:
    baseDirectory: /
    files:
      - index.html
      - app.js
      - 'views/**/*'
      - 'config/**/*'
      - 'data/**/*'
      - 'adapters/**/*'
      - 'core/**/*'
      - 'domains/**/*'
      - 'models/**/*'
      - 'styles/**/*'
-     - 'lambda/**/*'
```

## Data Flow (Updated)

### Initialization (Demo Mode)
```
1. app.js loads
2. Load initiatives (fixtures or API, unchanged from mvp-completion)
3. Run per-initiative pass:  initiativeSignals = runSignals(initiatives, ProcurementBundle, { asOfDate })
4. Run portfolio pass:       signals = runPortfolioSignals(initiatives, initiativeSignals, ProgramBundle, { asOfDate })
5. Derive workstream summaries (unchanged)
6. Call ViewManager.initViews(container, store, signals)
   → Pipeline_Table_View now derives each row's RAG from `signals` via deriveInitiativeRag()
   → Heatmap_View's deriveWorkstreamRag() is unchanged
```

## Error Handling

| Scenario | Handling | User Impact |
|----------|----------|--------------|
| Portfolio-pass evaluator throws | Caught per-evaluator, same isolation as `runSignals()`; logged, skipped | Other portfolio signals still compute |
| No owner meets concentration threshold | `owner-concentration` evaluator returns `[]` | No P4 signal shown — not an error state |
| `ALLOWED_ORIGIN` env var unset in deployed Lambda | CORS header falls back to an unmatchable origin | Browser requests fail CORS preflight — visible immediately in the console rather than silently open |
| Lambda test S3 mock not reset between tests | `t.mock.method()` is automatically restored after each test by `node:test` | No manual cleanup required |

## Correctness Properties

### Property 8: Initiative RAG Single Source of Truth
For any initiative, `deriveInitiativeRag(id, signals)` must return the same value regardless of which view calls it, and that value must be derivable purely from `signals` — no stored field on the initiative object may influence it.

**Validates: Requirement 1.2, 1.3, 1.4, 1.5**

### Property 9: Owner Concentration Threshold Determinism
Given the same initiatives and signals, `owner-concentration` must fire for an owner if and only if that owner is attributed on `>= thresholds.ownerConcentrationCount` initiatives each carrying a signal at priority `<= thresholds.atRiskPriority`.

**Validates: Requirement 2.2, 2.4**

### Property 10: CORS Fails Closed
If `ALLOWED_ORIGIN` is unset, no origin should be able to complete a CORS preflight against any of the three Lambda endpoints.

**Validates: Requirement 3.2**

## Testing Strategy

| Layer | Approach | Tool |
|-------|----------|------|
| `runPortfolioSignals()` | Unit tests: known initiative + signal inputs → expected owner-concentration output | `node --test` |
| `deriveInitiativeRag()` | Unit tests: signal sets → expected RAG letter, including the exact Resin & Packaging Substrate Rebid scenario from `transform.md` as a regression test | `node --test` |
| Pipeline view / RAG rendering | Real DOM render via `jsdom`, asserting rendered `.rag-dot` class matches `deriveInitiativeRag()` output for every row — this is the test category `mvp-completion` explicitly skipped; it's what caught the original bug | `node --test` + `jsdom` (new devDependency) |
| Lambda handlers | Integration tests per Requirement 4, mocked `S3Client.prototype.send` | `node --test`, `node:test` mock |
| CORS | Unit test: handler invoked with/without `ALLOWED_ORIGIN` set, assert header value | `node --test` |

`jsdom` is the one new devDependency this spec introduces. It closes the exact gap `transform.md` identified: nothing in `mvp-completion`'s suite ever rendered real DOM.

## Security Considerations

- CORS is now origin-restricted and fails closed by default, closing the gap flagged in `transform.md` where a missed Cognito-authorizer step and a wildcard origin would combine into a fully open API.
- No change to Cognito authorizer attachment — that remains a manual `DEPLOYMENT.md` step outside this spec's scope (attaching it via IaC is a reasonable Requirement 6 for a future spec, not folded in here to keep this pass small).
- Amplify artifact hardening (Requirement 5) removes the only path by which Lambda source was reachable from the public frontend URL.
