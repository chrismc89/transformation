# Implementation Plan: Signal Consistency Fix

## Overview

This plan closes five findings from the `mvp-completion` code review (`transform.md`): the initiative-level RAG bug, the missing owner-concentration evaluator, wildcard CORS, missing Lambda test coverage, and the Amplify artifact leak. Nothing in `core/signal-cascade.js`'s existing behavior, the six existing procurement evaluators, or any already-correct view logic is touched. Tasks are ordered so the engine/data layer lands first, then the view fix that depends on it, then the independent deployment/test hardening tasks.

## Tasks

- [x] 1. Add `runPortfolioSignals(initiatives, signals, portfolioBundle, options)` to `core/signal-cascade.js`: builds `{ initiatives, signals, asOfDate }` context, runs portfolio evaluators with the same try/catch isolation as `runSignals()`, merges and re-dedupes against the incoming per-initiative signals, returns priority-sorted output.
- [x] 2. Create `domains/program-bundle.js` with the `owner-concentration` evaluator (P4): groups at-risk (`priority <= thresholds.atRiskPriority`) signals by initiative owner, fires one signal per owner at or above `thresholds.ownerConcentrationCount`, states initiative count and combined `savings.target` exposure in the consequence text.
- [x] 3. Update `app.js`: call `runSignals()` for the per-initiative pass (unchanged), then `runPortfolioSignals(initiatives, initiativeSignals, ProgramBundle, { asOfDate })` for the portfolio pass, pass the merged result into `initViews()`.
- [x] 4. Add `deriveInitiativeRag(initiativeId, signals)` to `views/view-manager.js`, exported alongside `formatMillions`/`formatPct`/`ragClass`. Same P1→red, P2→amber, else-green logic as the existing `deriveWorkstreamRag()` in `heatmap-view.js`.
- [x] 5. Update `views/pipeline-view.js`: replace the `init.rag` read with `deriveInitiativeRag(init.id, signals)`; `renderPipeline`'s destructured context gains `signals` (already present on the context object `view-manager.js` builds, no new plumbing).
- [x] 6. Remove the `rag` field from every initiative and workstream object in `data/demo-fixtures.js` (13 initiatives + 7 workstreams). Remove the corresponding `entry.rag` accumulation from `_buildWorkstreams()` in `view-manager.js` — it read `init.rag` and was already unused by `heatmap-view.js`.
- [x] 7. Update `lambda/read-initiatives.js`, `lambda/write-initiatives.js`, `lambda/sync-asana.js`: replace hardcoded `'Access-Control-Allow-Origin': '*'` with `process.env.ALLOWED_ORIGIN || 'https://origin-not-configured.invalid'`, applied identically in all three files.
- [x] 8. Add `ALLOWED_ORIGIN` to the Lambda Environment Variables table in `DEPLOYMENT.md` with an example value (the Amplify domain).
- [x] 9. Install `jsdom` as a devDependency. Add `tests/pipeline-view.render.test.js`: real DOM render of `renderPipeline()` against demo fixtures + live signals, asserting every rendered `.rag-dot` class matches `deriveInitiativeRag()` — include the Resin & Packaging Substrate Rebid case from `transform.md` explicitly as a named regression test.
- [x] 10. Add `tests/lambda-read-initiatives.test.js`, `tests/lambda-write-initiatives.test.js`, `tests/lambda-sync-asana.test.js`: integration tests per Requirement 4's acceptance criteria, mocking `S3Client.prototype.send` via `node:test`'s built-in `t.mock.method()` — no new dependency beyond `jsdom` from task 9.
- [x] 11. Remove `'lambda/**/*'` from the `artifacts.files` list in `amplify.yml`.
- [x] 12. Run the full suite (`npm test`) and confirm: existing 122 tests still pass, new tests pass, and a manual `jsdom` smoke run (same script used in the `transform.md` review) shows zero RAG mismatches across all 13 demo initiatives.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 2], "description": "Engine: portfolio pass + owner-concentration evaluator (independent of each other's internals, both needed before task 3)" },
    { "wave": 2, "tasks": [3, 4], "description": "Wire portfolio pass into app.js; add shared RAG utility (both depend on wave 1 / are independent of each other)" },
    { "wave": 3, "tasks": [5, 6], "description": "Pipeline view fix + fixture cleanup (depend on task 4)" },
    { "wave": 4, "tasks": [7, 8, 11], "description": "Deployment hardening: CORS + Amplify artifacts (independent of engine/view work)" },
    { "wave": 5, "tasks": [9, 10], "description": "Test coverage: RAG regression test (depends on 5, 6) and Lambda integration tests (depends on 7)" },
    { "wave": 6, "tasks": [12], "description": "Full suite verification" }
  ]
}
```

## Notes

- Tasks 7, 8, and 11 (CORS + Amplify artifacts) have no dependency on the RAG/owner-concentration work and can be done first or in parallel if you want the deployment-hardening half shipped sooner.
- Task 9 introduces `jsdom` as this codebase's first devDependency beyond `serve` — it exists specifically to close the "tests never render real DOM" gap `transform.md` flagged; scope it to the pipeline-view regression only rather than retrofitting all four views in this pass.
- Task 2's `owner-concentration` evaluator was originally scoped to the *earlier* procurement-bundle spec (predates `mvp-completion`), not this one — confirm after task 2 that no duplicate/competing implementation exists elsewhere before wiring it into `app.js` in task 3.
- No changes to Cognito authorizer attachment (still a manual `DEPLOYMENT.md` step) or to any of the six existing procurement evaluators.
