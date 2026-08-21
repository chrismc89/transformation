# Implementation Plan:

## Overview

This plan implements the remaining MVP features for the Signal Engine Procurement PMO: demo fixture data, app config, CSS, views (dashboard, heatmap, pipeline, ELT export), app entry point, Asana adapter, Lambda functions, and Amplify deployment config. Tasks are ordered so that foundational modules (data, config, styles) are built first, then views consume them, and finally deployment wraps everything up.

## Tasks

- [x] 1. Create demo fixture data module (`data/demo-fixtures.js`) with 13 initiative objects matching demo HTML synthetic data, 7 workstream summary objects, and programMeta export. Verify totals: ~$18.8M target, ~$14.3M validated, ~$5.35M realized.
- [x] 2. Create app config module (`config/app-config.js`) exporting default config with apiUrl (null for demo mode), fyCommitment ($15M), programStartDate, programEndDate, and asana (null for no sync).
- [x] 3. Create CSS stylesheet (`styles/main.css`) extracting all styles from demo HTML: design tokens, header, KPI strip, signal feed, heatmap table, pipeline table, stage badges, sync badges, brief card, chart wrapper, footer, and responsive breakpoint at 860px.
- [x] 4. Create view-manager module (`views/view-manager.js`) with initViews, refreshAll, renderView exports, plus shared utility functions formatMillions, formatPct, and ragClass.
- [x] 5. Build dashboard view (`views/dashboard-view.js`) with renderDashboard export: KPI strip (5 metrics), signal feed (P1–P5 sorted, color-coded, with empty state message), and Chart.js workstream grouped bar chart.
- [x] 6. Build heatmap view (`views/heatmap-view.js`) with renderHeatmap export: workstream table with initiative count, target, validated, realized, % to target (color-coded), and RAG derived from worst signal priority.
- [x] 7. Build pipeline table view (`views/pipeline-view.js`) with renderPipeline export: initiative table with RAG dot, owner, stage badge (5 distinct styles), savings columns, due date, and Asana sync freshness indicator.
- [x] 8. Build ELT export view (`views/elt-export-view.js`) with renderELTExport export: steering committee summary card with dynamic narrative, P1 initiative highlights, statistics row, and export button that downloads a print-ready HTML file.
- [x] 9. Create main entry point (`index.html` and `app.js`): HTML structure with view containers and Chart.js CDN; app.js initialization flow checking config, loading data (fixtures or API with fallback), running signal cascade, deriving workstreams, and calling initViews.
- [x] 10. Build Asana adapter (`adapters/asana-adapter.js`) with configure, sync, and mapFields methods: custom field extraction by GID, dollar value parsing, stage enum mapping with fallback to 'identified', lastSyncedAt stamping, and structured error responses for auth/network/rate-limit failures.
- [x] 11. Create Lambda functions (`lambda/read-initiatives.js`, `lambda/write-initiatives.js`, `lambda/sync-asana.js`): S3 read returning initiative array (empty array if missing), S3 write accepting JSON body, and sync function orchestrating Asana adapter with S3 persistence.
- [x] 12. Create Amplify deployment configuration (`amplify.yml`) with static hosting config and document deployment steps for connecting GitHub repo, configuring auto-deploy, and setting Lambda environment variables.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 2, 3], "description": "Foundation: fixture data, config, CSS (independent)" },
    { "wave": 2, "tasks": [4], "description": "View manager (depends on 1, 2, 3)" },
    { "wave": 3, "tasks": [5, 6, 7, 8, 10], "description": "Views and Asana adapter (depends on 4; parallel)" },
    { "wave": 4, "tasks": [9, 11], "description": "App entry point and Lambda functions (depends on 5-8, 10)" },
    { "wave": 5, "tasks": [12], "description": "Amplify deployment config (depends on 9, 11)" }
  ]
}
```

## Notes

- Tasks 1–3 are independent and can be built in parallel.
- Tasks 5–8 (views) depend on task 4 (view-manager) and can be built in parallel with each other.
- Task 9 integrates all views and is the main frontend deliverable.
- Tasks 10–11 (Asana adapter + Lambda) can be built in parallel with views.
- Task 12 (deployment) is the final step that packages everything.
- The existing `core/signal-cascade.js`, `domains/procurement-bundle.js`, and `models/initiative-store.js` are consumed as-is — no modifications needed.
