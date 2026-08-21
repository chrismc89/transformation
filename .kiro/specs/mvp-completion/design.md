# Technical Design Document

## Overview

This document defines the technical design for completing the Signal Engine Procurement PMO MVP. It covers four build areas: views (dashboard, heatmap, pipeline table, ELT export), Asana adapter, demo fixture data, and AWS deployment. The application is a static frontend with a thin serverless backend, matching the same minimal-stack philosophy as Truetempo.

Reference: #[[PMOTransformation.md]]

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Static Frontend — Amplify Hosting)                │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Dashboard │  │ Heatmap   │  │ Pipeline │  │  ELT    │  │
│  │   View    │  │   View    │  │  Table   │  │ Export  │  │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬────┘  │
│        └───────────────┴─────────────┴──────────────┘       │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              │    ViewManager        │                      │
│              │  (orchestrates views) │                      │
│              └───────────┬───────────┘                      │
│                          │                                  │
│        ┌─────────────────┼─────────────────┐               │
│        │                 │                 │               │
│  ┌─────┴─────┐  ┌───────┴───────┐  ┌─────┴──────┐        │
│  │Initiative │  │Signal Cascade │  │  Chart.js  │        │
│  │  Store    │  │   Engine      │  │            │        │
│  └─────┬─────┘  └───────────────┘  └────────────┘        │
│        │                                                   │
│  ┌─────┴──────────────┐                                   │
│  │ Demo Fixture Data  │  (default when no API configured) │
│  └────────────────────┘                                   │
└────────────────────────────────┬────────────────────────────┘
                                 │ fetch() — JSON API
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  AWS Backend                                                │
│                                                             │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────┐     │
│  │  API GW  │───▶│  Lambda Fns   │───▶│  S3 (JSON)   │     │
│  │  + Auth  │    │               │    │  initiative  │     │
│  └──────────┘    │  - read       │    │  store       │     │
│       │          │  - write      │    └──────────────┘     │
│  ┌────┴─────┐    │  - sync       │                         │
│  │ Cognito  │    └───────┬───────┘                         │
│  │ User Pool│            │                                 │
│  └──────────┘            ▼                                 │
│                   ┌──────────────┐                         │
│                   │ Asana API    │                         │
│                   │ (external)   │                         │
│                   └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Technology Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | None (vanilla JS + ES modules) | Same pattern as demo HTML; no build step needed; minimal deployment complexity |
| Charting | Chart.js 4.x (CDN) | Already used in demo; lightweight; no npm dependency for frontend |
| CSS approach | Single CSS file (design tokens) | Extracted from demo HTML; consistent with Truetempo design system |
| Backend runtime | Node.js 20.x Lambda | Matches frontend language; minimal cold start |
| Data store | S3 JSON file | Simplest possible persistence for <100 records; no DB overhead |
| Auth | Cognito | AWS-native; minimal config for single-user MVP |
| Export format | HTML (print-ready) | MVP scope; PPTX generation is post-MVP enhancement |
| Module system | ES modules (import/export) | Already used in existing codebase |

**File Structure (New Files):**

```
transformation/
├── index.html                    ← Main app entry (new, replaces demo HTML)
├── app.js                        ← App initialization, data loading
├── views/
│   ├── view-manager.js           ← View orchestration and shared utils
│   ├── dashboard-view.js         ← KPI strip, signal feed, chart
│   ├── heatmap-view.js           ← Workstream heatmap table
│   ├── pipeline-view.js          ← Initiative pipeline table
│   └── elt-export-view.js        ← ELT summary card and export
├── adapters/
│   └── asana-adapter.js          ← Asana field mapping and sync
├── data/
│   └── demo-fixtures.js          ← Synthetic initiative + workstream data
├── config/
│   └── app-config.js             ← Runtime config (API URL, feature flags)
├── styles/
│   └── main.css                  ← CSS extracted from demo HTML design system
├── lambda/
│   ├── read-initiatives.js       ← S3 read function
│   ├── write-initiatives.js      ← S3 write function
│   └── sync-asana.js             ← Asana sync function
└── amplify.yml                   ← Amplify build config
```

## Components and Interfaces

### 1. View Manager (`views/view-manager.js`)

Orchestrates view rendering and provides shared utilities.

```javascript
// Public API
export function initViews(containerEl, store, signalEngine)
export function refreshAll()
export function renderView(viewName)  // 'dashboard' | 'heatmap' | 'pipeline' | 'elt'

// Shared utilities (exported)
export function formatMillions(value)   // 3200000 → "$3.20M"
export function formatPct(ratio)        // 0.76 → "76%"
export function ragClass(rag)           // 'r' → 'cell-r'
```

**Responsibilities:**
- Holds references to the InitiativeStore and signal cascade output
- Calls individual view render functions on init and on data change
- Provides shared formatting utilities

### 2. Dashboard View (`views/dashboard-view.js`)

Renders the KPI strip, signal feed, and workstream chart.

```javascript
// Public API
export function renderDashboard(container, { store, signals, workstreams })
```

**Internal structure:**
- `renderKPIStrip(container, summary)` — 5 metric cards
- `renderSignalFeed(container, signals)` — P1–P5 signal list
- `renderWorkstreamChart(container, workstreams)` — Chart.js grouped bar

**KPI calculations:**

| Metric | Source |
|--------|--------|
| Pipeline Identified | `store.getSummary().totalTarget` |
| Finance-Validated | `store.getSummary().totalValidated` |
| Realized to Date | `store.getSummary().totalRealized` |
| At Risk (P1/P2) | Sum of `savings.target` for initiatives with P1 or P2 signals |
| Program Pacing | `(totalRealized / FY_COMMITMENT) * 100` |

### 3. Heatmap View (`views/heatmap-view.js`)

Renders the workstream heatmap table.

```javascript
// Public API
export function renderHeatmap(container, { workstreams, signals })
```

**RAG derivation logic:**
1. For each workstream, find all signals targeting initiatives in that workstream
2. If any signal is P1 → RAG = red
3. Else if any signal is P2 → RAG = amber
4. Else → RAG = green

### 4. Pipeline View (`views/pipeline-view.js`)

Renders the full initiative pipeline table.

```javascript
// Public API
export function renderPipeline(container, { initiatives, thresholds })
```

**Stage badge mapping:**

| Stage | CSS class | Color scheme |
|-------|-----------|--------------|
| Identified | `stage-identified` | Gray |
| Validated | `stage-validated` | Amber |
| Negotiating | `stage-negotiating` | Blue |
| Implementing | `stage-implementing` | Navy |
| Realized | `stage-realized` | Green |

**Sync freshness:**
- Fresh: `lastSyncedAt` within `thresholds.staleActivityDays` → green dot
- Stale: beyond threshold → amber dot

### 5. ELT Export View (`views/elt-export-view.js`)

Renders the ELT steering committee summary card.

```javascript
// Public API
export function renderELTExport(container, { summary, signals, initiatives })
```

**Narrative generation:**
- Template-driven string with dynamic values from `summary`
- P1 initiatives listed by name in the "requires attention" paragraph
- Export button triggers `generateExport()` which produces a downloadable HTML file (print-ready steering committee summary)

### 6. Asana Adapter (`adapters/asana-adapter.js`)

```javascript
// Public API
export default {
  configure(config),       // { projectId, accessTokenRef, fieldMappings }
  sync(initiativeStore),   // Full sync → returns { updated: [], errors: [] }
  mapFields(asanaTask),    // Single task → Initiative partial object
}
```

**Configuration schema:**

```javascript
const config = {
  projectId: 'proj_123',
  accessTokenRef: 'ASANA_TOKEN',      // env var name, resolved at runtime
  fieldMappings: {
    baseline: 'custom_field_gid_baseline',
    target: 'custom_field_gid_target',
    validated: 'custom_field_gid_validated',
    realized: 'custom_field_gid_realized',
    stage: 'custom_field_gid_stage',
  },
  stageValueMap: {
    'Identified': 'identified',
    'Validated': 'validated',
    'Negotiating': 'negotiating',
    'Implementing': 'implementing',
    'Realized': 'realized',
  }
};
```

**Field mapping logic:**
1. Extract custom fields from `asanaTask.custom_fields[]`
2. For each savings field (baseline, target, validated, realized): find field by GID → parse `number_value` → store in savings object
3. For stage field: find field by GID → lookup `enum_value.name` in `stageValueMap` → if not found, log warning and default to `'identified'`
4. Set `lastSyncedAt` = current ISO timestamp
5. Return partial initiative object for merging

### 7. Demo Fixture Module (`data/demo-fixtures.js`)

```javascript
// Public API
export const initiatives = [ /* 13 initiative objects */ ];
export const workstreams = [ /* 7 workstream summary objects */ ];
export const programMeta = { day: 214, totalDays: 540, fyCommitment: 15000000, weekOf: '2026-08-10' };
```

### 8. App Config (`config/app-config.js`)

```javascript
// Public API
export default {
  apiUrl: null,              // null = demo mode, string = production API Gateway URL
  fyCommitment: 15000000,   // $15M FY savings commitment
  programStartDate: '2026-01-15',
  programEndDate: '2027-07-08',
  asana: null,               // null = no sync, object = AsanaAdapter config
}
```

### 9. Lambda Functions (`lambda/`)

**read-initiatives.js:**
```javascript
// GET /api/initiatives
// Reads initiatives.json from S3 → returns JSON array
// Returns [] if file does not exist
```

**write-initiatives.js:**
```javascript
// PUT /api/initiatives
// Body: JSON array of initiative objects
// Writes to S3 → returns { success: true }
```

**sync-asana.js:**
```javascript
// POST /api/sync OR EventBridge scheduled trigger
// Reads current initiatives from S3
// Runs AsanaAdapter.sync()
// Writes updated initiatives to S3
// Returns { success: true, updated: count, errors: [] }
```

## Data Models

### Initiative Object

```javascript
{
  id: 'init-001',                    // Unique identifier
  name: 'Steel/Alloy Supplier Consolidation',
  workstream: 'Direct Materials',     // One of 7 workstream names
  owner: 'J. Alvarez',               // Owner display name
  stage: 'implementing',             // identified | validated | negotiating | implementing | realized
  savings: {
    baseline: 3200000,               // Original estimate ($)
    target: 3200000,                 // Current target ($)
    validated: 2900000,              // Finance-validated amount ($)
    realized: 1400000,               // Actually captured ($)
  },
  dueDate: '2026-10-15',            // ISO date string
  asanaProjectId: 'proj_001',        // Asana project GID
  lastSyncedAt: '2026-08-12T10:00:00Z',  // Last Asana sync timestamp
  createdAt: '2026-01-15T00:00:00Z',     // Initiative creation date
  rag: 'a',                          // Pre-computed RAG: 'g' | 'a' | 'r'
  priorValidated: null,              // Previous validated amount (for forecast delta)
}
```

### Workstream Summary Object

```javascript
{
  name: 'Direct Materials',
  target: 4.3,          // $M
  validated: 3.5,       // $M
  realized: 1.4,        // $M
  rag: 'a',             // Worst RAG across initiatives in workstream
}
```

### Signal Object (output from signal cascade)

```javascript
{
  priority: 1,                       // 1-5 (P1 highest)
  id: 'critical-initiative-overdue', // Evaluator ID
  initiativeId: 'init-011',          // Which initiative triggered this
  title: 'Critical initiative overdue — Facilities Services Rebid',
  consequence: 'Due date passed 4 days ago. Savings not realized.',
  action: 'Escalate to M. Delgado or reassign owner today.',
}
```

### Asana Adapter Error Object

```javascript
{
  success: false,
  error: {
    code: 'ASANA_AUTH_FAILED' | 'ASANA_NETWORK_ERROR' | 'ASANA_RATE_LIMITED',
    message: 'Human-readable error description',
    retryAfter: null,    // seconds, only for rate limiting
  }
}
```

## Data Flow

### Initialization (Demo Mode)
```
1. app.js loads
2. Check config: apiUrl defined?
   - No → import demo-fixtures.js → InitiativeStore.load(fixtures)
   - Yes → fetch(apiUrl + '/initiatives')
     - Success → InitiativeStore.load(response)
     - Failure → fallback to demo-fixtures.js
3. Run signal cascade: runSignals(store.getAll(), ProcurementBundle, { asOfDate })
4. Derive workstream summaries from InitiativeStore
5. Call ViewManager.initViews() → renders all four views
```

### Asana Sync (Production Mode)
```
1. Trigger: EventBridge schedule OR POST /api/sync
2. Lambda: sync-asana
   a. Read current initiatives.json from S3
   b. Fetch tasks from Asana API using configured project + field mappings
   c. For each task → AsanaAdapter.mapFields(task) → merge into initiative array
   d. Write updated initiatives.json to S3
   e. Return { success: true, updated: count, errors: [] }
```

### Export Flow
```
1. User clicks "Export to CFO Deck" button
2. elt-export-view.js gathers: summary, P1 signals, initiative names
3. Generates structured HTML document (print-ready) with:
   - Steering committee narrative
   - KPI summary table
   - P1/P2 action items
   - Workstream heatmap snapshot
4. Triggers browser download of the HTML file
```

## Error Handling

| Scenario | Handling | User Impact |
|----------|----------|-------------|
| API fetch fails on load | Fall back to demo fixtures; show "demo mode" indicator | Views render with fixture data |
| Asana sync network error | Return structured error; do not mutate store | Sync status shows last successful timestamp |
| Asana auth failure (401/403) | Return `ASANA_AUTH_FAILED`; log to CloudWatch | Admin notified; data remains at last good state |
| Asana rate limited (429) | Return `ASANA_RATE_LIMITED` with retry-after | Sync retried on next scheduled invocation |
| Unrecognized pipeline stage from Asana | Log warning; default to 'identified' | Initiative shows in pipeline with safe default |
| S3 file missing on read | Return empty array `[]` | Views render with no data; prompt to sync or load fixtures |
| Lambda timeout | API Gateway returns 504 | Frontend shows "sync timed out" message |
| Chart.js CDN unavailable | Chart container shows fallback text "Chart unavailable" | KPI strip and tables still render normally |
| Invalid initiative data shape | Validate on load; skip malformed records with warning | Partial data renders; console warning for debugging |

## Correctness Properties

### Property 1: Signal Determinism
Given the same initiative array and `asOfDate`, `runSignals()` must produce the same signal set in the same order.

**Validates: Requirements 2.1**

### Property 2: KPI Consistency
The sum of all initiative `savings.target` values must equal the Pipeline Identified KPI. The same holds for validated and realized.

**Validates: Requirements 1.2**

### Property 3: RAG Derivation Consistency
A workstream's RAG must equal 'r' if and only if at least one initiative in that workstream has an active P1 signal; 'a' if P2 but no P1; 'g' otherwise.

**Validates: Requirements 4.5**

### Property 4: Dedup Correctness
No two signals in the final feed may share the same `(id, initiativeId)` pair.

**Validates: Requirements 2.1**

### Property 5: Stage Mapping Completeness
All five valid pipeline stages must map correctly from Asana enum values. Any unmapped value defaults to 'identified' without throwing.

**Validates: Requirements 7.2, 7.3**

### Property 6: Fixture Fidelity
Demo fixture data must produce the same KPIs (within rounding) as displayed in the demo HTML: $18.8M identified, $14.3M validated, $5.35M realized.

**Validates: Requirements 9.3**

### Property 7: Fallback Guarantee
If `apiUrl` is null or fetch fails, the application must render successfully using demo fixtures — never show a blank/error state.

**Validates: Requirements 9.4**

**Validates: Requirement 9.4**

## Testing Strategy

| Layer | Approach | Tool |
|-------|----------|------|
| Signal evaluators | Unit tests: known initiative inputs → expected signal outputs | Node.js test runner (`node --test`) |
| InitiativeStore | Unit tests: load, query, summary calculations | Node.js test runner |
| Asana field mapping | Unit tests: mock Asana task objects → expected initiative partials | Node.js test runner |
| View rendering | Manual verification against demo HTML output | Browser comparison |
| KPI accuracy | Unit test: load fixtures → assert summary matches expected values | Node.js test runner |
| Lambda functions | Integration test: mock S3 client, verify read/write behavior | Node.js test runner with mocked AWS SDK |
| End-to-end | Manual: deploy to Amplify, verify all views render, sync button works | Browser + AWS Console |

## Security Considerations

- Asana access token stored in AWS Secrets Manager, referenced by env var in Lambda
- Cognito authorizer on all API Gateway endpoints (no unauthenticated API access)
- S3 bucket private, accessed only via Lambda execution role
- CORS restricted to Amplify domain origin
- No PII in initiative data (owner names are initials + surname only)
- Demo fixtures contain only synthetic data
