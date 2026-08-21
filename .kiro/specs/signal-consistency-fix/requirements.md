# Requirements Document

## Introduction

This spec addresses five findings from a code review of the `mvp-completion` build (see `transform.md`, reviewed against that spec's own `requirements.md`/`design.md`). Two are places where the implementation didn't follow an already-correct design (CORS, Lambda test coverage); one is a design gap that let a real bug through (initiative-level RAG); one is a portfolio-level signal that was out of `mvp-completion`'s scope and was never implemented (owner concentration); one is an unspecified deployment detail that turned out wrong (Amplify build artifacts). This spec covers all five so the next Kiro run has explicit contracts for each.

## Glossary

- **Live_RAG_Derivation**: Computing an item's RAG status ('r'/'a'/'g') at render time from the current signal set, rather than reading a stored/static field
- **Owner_Concentration_Evaluator**: A portfolio-level (not per-initiative) evaluator that inspects all initiatives and all already-computed signals in a single run to detect capacity risk
- **Portfolio_Pass**: A second evaluation pass, run after the per-initiative Signal_Cascade_Engine pass, with visibility into the full initiative set and the full signal set
- **CORS_Policy**: The `Access-Control-Allow-Origin` behavior of the three Lambda functions
- **Lambda_Integration_Test**: A test that exercises a full Lambda `handler()` function against a mocked S3 client, without live AWS credentials

## Requirements

### Requirement 1: Initiative-Level RAG Must Derive From Live Signals

**User Story:** As a PMO lead, I want each initiative's RAG dot in the pipeline table to reflect its current signal status, so that the pipeline table never contradicts the signal feed on the same screen.

#### Acceptance Criteria

1. THE Initiative data model SHALL NOT carry a pre-computed `rag` field. `Pipeline_Table_View` SHALL compute RAG at render time from the current `Signal_Cascade_Engine` output.
2. WHEN an initiative has at least one active P1 signal, THE `Pipeline_Table_View` SHALL render its RAG dot as red (`'r'`).
3. WHEN an initiative has no P1 signal but at least one active P2 signal, THE `Pipeline_Table_View` SHALL render its RAG dot as amber (`'a'`).
4. WHEN an initiative has no active P1 or P2 signal, THE `Pipeline_Table_View` SHALL render its RAG dot as green (`'g'`).
5. THE per-initiative RAG derivation logic SHALL be implemented exactly once (a shared utility) and used identically by `Pipeline_Table_View`, `Heatmap_View`, and `Dashboard_View` — no view may compute RAG by an independent method.
6. WHEN demo fixture data is written or edited, THE `Demo_Fixture_Module` SHALL NOT need to specify a `rag` value per initiative or per workstream.
7. THE existing `Heatmap_View` workstream-level RAG derivation (Requirement 4.5 of `mvp-completion`) SHALL be unaffected — this requirement only removes the *static* initiative-level field and its one consumer (`Pipeline_Table_View`).

### Requirement 2: Owner Concentration Signal (P4)

**User Story:** As a PMO lead, I want to be warned when one owner holds a disproportionate share of at-risk initiatives, so that I can rebalance capacity before it becomes a bottleneck.

#### Acceptance Criteria

1. THE `Signal_Cascade_Engine` SHALL support a `Portfolio_Pass` that runs after per-initiative evaluation, with read access to the full initiative array and the full signal array already produced.
2. WHEN a single owner is attributed on 2 or more initiatives that each carry an active P1 or P2 signal, THE `Owner_Concentration_Evaluator` SHALL produce one P4 signal naming that owner.
3. THE `Owner_Concentration_Evaluator`'s signal `consequence` text SHALL state the number of at-risk initiatives and the combined `savings.target` dollar exposure held by that owner.
4. THE at-risk-initiative-count threshold (default 2) SHALL be configurable via `thresholds.ownerConcentrationCount`.
5. THE `Owner_Concentration_Evaluator` SHALL produce at most one signal per owner per run, never one per initiative.
6. IF no owner meets the concentration threshold, THEN THE `Owner_Concentration_Evaluator` SHALL return an empty array — it SHALL NOT throw or block the rest of the Portfolio_Pass.

### Requirement 3: Lambda API CORS Restriction

**User Story:** As an operator, I want the Lambda API to only accept cross-origin requests from the deployed Amplify domain, so initiative data isn't readable or writable from arbitrary origins if the Cognito authorizer step is ever missed.

#### Acceptance Criteria

1. THE Deployment_Stack SHALL read the allowed CORS origin from an `ALLOWED_ORIGIN` environment variable on each Lambda function — not a hardcoded `*`.
2. IF `ALLOWED_ORIGIN` is not set, THEN THE Lambda function SHALL default to a value that fails closed (an origin no real browser will ever match), not to `*`.
3. THE `read-initiatives`, `write-initiatives`, and `sync-asana` Lambda functions SHALL all apply the same CORS policy via one shared helper.
4. THE `Access-Control-Allow-Origin` response header SHALL reflect the configured origin — not a wildcard — on every response, including error and OPTIONS-preflight responses.

### Requirement 4: Lambda Integration Test Coverage

**User Story:** As a developer, I want the three Lambda handlers covered by integration tests against a mocked S3 client, so persistence and sync logic is verified the same way the rest of the codebase already is (`design.md`'s own Testing Strategy table commits to this and it was never delivered).

#### Acceptance Criteria

1. THE test suite SHALL include `Lambda_Integration_Test`s for `read-initiatives.js` covering: successful read, missing-file (`NoSuchKey`) returning `[]`, and an unexpected S3 error returning HTTP 500.
2. THE test suite SHALL include `Lambda_Integration_Test`s for `write-initiatives.js` covering: a valid array body writes successfully and returns HTTP 200, a non-array body returns HTTP 400, and a malformed JSON body returns HTTP 400.
3. THE test suite SHALL include `Lambda_Integration_Test`s for `sync-asana.js` covering: a missing `ASANA_PROJECT_ID` returns HTTP 400, an Asana adapter auth/network/rate-limit failure propagates as HTTP 502 with the adapter's structured error code, and a successful sync merges results and writes back to S3.
4. THE S3 client SHALL be mocked in every `Lambda_Integration_Test` — no test may require real AWS credentials or network access.
5. THE test suite SHALL run via the existing `node --test tests/*.test.js` command with no new production dependency — mocking SHALL use Node's built-in `node:test` mock support.

### Requirement 5: Amplify Build Artifact Hardening

**User Story:** As an operator, I want the Amplify Hosting build to exclude backend source, so Lambda implementation details (env var names, S3 key structure, field-mapping logic) aren't publicly downloadable from the app's URL.

#### Acceptance Criteria

1. THE `amplify.yml` frontend `artifacts.files` list SHALL NOT include `lambda/**/*` or any other backend-only source.
2. THE Amplify Hosting build SHALL publish only files required by the browser: `index.html`, `app.js`, `views/**/*`, `config/**/*`, `data/**/*`, `adapters/**/*`, `core/**/*`, `domains/**/*`, `models/**/*`, `styles/**/*`.
3. WHEN this change is deployed, THE frontend application SHALL continue to function identically. Lambda functions deploy through a separate path (SAM or console) per `DEPLOYMENT.md` — they were never meant to ship through Amplify Hosting artifacts.
