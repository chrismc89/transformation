# Requirements Document

## Introduction

This document defines the remaining MVP features for the Signal Engine Procurement PMO application. The system already has a working signal cascade engine, procurement domain bundle (7 evaluators), and an initiative store model. This spec covers the four remaining build areas: views (dashboard, heatmap, pipeline table, ELT export), Asana adapter (field mapping for dollar values and pipeline stage), demo fixture data (synthetic data matching the demo HTML), and deployment to AWS Amplify + Lambda.

## Glossary

- **Dashboard_View**: The primary executive-facing view that renders KPI summary cards, the signal feed (P1–P5), and the workstream savings chart
- **Heatmap_View**: A tabular view showing each workstream's initiative count, target/validated/realized savings, percentage to target, and RAG status
- **Pipeline_Table_View**: A tabular view listing all initiatives with owner, stage, savings figures, due date, and Asana sync status
- **ELT_Export_View**: A steering committee summary card with narrative text, key statistics, and an export action for CFO deck generation
- **Asana_Adapter**: A module that maps Asana custom fields (dollar values, pipeline stage) to the InitiativeStore data model and syncs task activity timestamps
- **Demo_Fixture_Module**: A data module that provides synthetic initiative and workstream data for development and demonstration without requiring external service connections
- **Deployment_Stack**: The AWS infrastructure (Amplify static hosting, Lambda functions, API Gateway, S3 JSON store, Cognito auth) that serves the application
- **Initiative**: A procurement savings opportunity tracked through pipeline stages with baseline, target, validated, and realized dollar values
- **Workstream**: A logical grouping of related initiatives (e.g., Direct Materials, Logistics & Freight)
- **RAG_Status**: Red/Amber/Green indicator derived from the worst signal priority within a workstream or initiative
- **Signal_Feed**: The deduplicated, priority-ordered list of P1–P5 signals produced by the signal cascade engine
- **KPI_Strip**: The row of five summary metric cards at the top of the Dashboard_View
- **Pipeline_Stage**: One of five ordered states an initiative passes through: Identified, Validated, Negotiating, Implementing, Realized
- **Signal_Cascade_Engine**: The existing core module that runs evaluators against initiatives, deduplicates results, and returns prioritized signals

## Requirements

### Requirement 1: Dashboard View — KPI Strip

**User Story:** As a procurement executive, I want to see high-level pipeline metrics at a glance, so that I can quickly assess program health without drilling into detail.

#### Acceptance Criteria

1. WHEN the Dashboard_View loads, THE KPI_Strip SHALL render five metric cards: Pipeline Identified (total target savings), Finance-Validated (total validated savings), Realized to Date (total realized savings), At Risk P1/P2 (sum of at-risk initiative savings), and Program Pacing (realized percentage vs. elapsed time)
2. WHEN initiative data changes, THE KPI_Strip SHALL recalculate all five metrics from the current InitiativeStore state
3. THE KPI_Strip SHALL format dollar values in abbreviated millions notation (e.g., "$18.8M") and percentages as whole numbers with a percent sign
4. THE KPI_Strip SHALL display a subtitle beneath each metric showing supporting context (initiative count, percentage of pipeline, or pacing comparison)

### Requirement 2: Dashboard View — Signal Feed

**User Story:** As a procurement executive, I want to see the prioritized signal feed on the dashboard, so that I can understand what needs attention this week.

#### Acceptance Criteria

1. WHEN the Dashboard_View loads, THE Signal_Feed SHALL display all signals produced by the Signal_Cascade_Engine sorted by priority (P1 first through P5 last)
2. THE Signal_Feed SHALL render each signal with a priority tag, title, description, and recommended action
3. THE Signal_Feed SHALL apply distinct visual styling (border color and tag color) for each priority level P1 through P5
4. WHEN the initiative data contains no signals, THE Signal_Feed SHALL display a message indicating no active signals

### Requirement 3: Dashboard View — Workstream Savings Chart

**User Story:** As a procurement executive, I want to see a bar chart comparing target, validated, and realized savings across workstreams, so that I can visualize where savings are tracking.

#### Acceptance Criteria

1. WHEN the Dashboard_View loads, THE Dashboard_View SHALL render a grouped bar chart with one group per workstream showing target, validated, and realized savings
2. THE Dashboard_View SHALL label the chart Y-axis in millions of dollars and the X-axis with workstream names
3. THE Dashboard_View SHALL use Chart.js as the charting library
4. WHEN workstream data updates, THE Dashboard_View SHALL re-render the chart with current values

### Requirement 4: Workstream Heatmap View

**User Story:** As a PMO lead, I want a heatmap table showing each workstream's health metrics, so that I can identify underperforming areas quickly.

#### Acceptance Criteria

1. WHEN the Heatmap_View loads, THE Heatmap_View SHALL render a table with columns: Workstream, Initiatives (count), Target, Validated, Realized, % to Target, and RAG
2. THE Heatmap_View SHALL compute the initiative count per workstream from the InitiativeStore
3. THE Heatmap_View SHALL compute the percentage-to-target as validated divided by target, formatted as a whole number percent
4. THE Heatmap_View SHALL apply background color styling to the percentage cell based on RAG_Status: green for on-track, amber for at-risk, red for critical
5. THE Heatmap_View SHALL derive RAG_Status for each workstream from the highest-priority signal affecting any initiative in that workstream

### Requirement 5: Pipeline Table View

**User Story:** As a PMO lead, I want a detailed table of all initiatives with stage, savings, owner, and sync status, so that I can manage the pipeline at an individual initiative level.

#### Acceptance Criteria

1. WHEN the Pipeline_Table_View loads, THE Pipeline_Table_View SHALL render a table with columns: Initiative (with RAG dot), Owner, Stage, Target, Validated, Realized, Due Date, and Asana Sync date
2. THE Pipeline_Table_View SHALL display the Pipeline_Stage as a styled badge with distinct color per stage (Identified, Validated, Negotiating, Implementing, Realized)
3. THE Pipeline_Table_View SHALL display the Asana sync date with a status indicator: green dot for recent sync, amber dot for stale sync (exceeding the stale activity threshold)
4. THE Pipeline_Table_View SHALL format all dollar values in abbreviated millions notation and dates in ISO format (YYYY-MM-DD)

### Requirement 6: ELT Export View

**User Story:** As a procurement executive, I want a steering committee summary card with key narrative and an export action, so that I can quickly produce the CFO deck for weekly cadence.

#### Acceptance Criteria

1. WHEN the ELT_Export_View loads, THE ELT_Export_View SHALL render a summary card containing: a narrative paragraph describing pipeline status, a statistics row showing open P1/P2 count, workstream count, and initiative count, and an export button labeled "Export to CFO Deck (PPTX)"
2. THE ELT_Export_View SHALL generate the narrative paragraph dynamically from current InitiativeStore data, including total identified pipeline, validation percentage, realized amount, and the FY commitment figure
3. THE ELT_Export_View SHALL highlight initiatives requiring ELT attention (those with active P1 signals) by name in the narrative
4. WHEN the export button is activated, THE ELT_Export_View SHALL trigger a download action producing a formatted export file

### Requirement 7: Asana Adapter — Field Mapping

**User Story:** As a system integrator, I want the Asana adapter to map custom fields from Asana projects to the InitiativeStore model, so that initiative data stays synchronized with the project management tool.

#### Acceptance Criteria

1. THE Asana_Adapter SHALL map Asana custom field values for dollar amounts (baseline, target, validated, realized) to the corresponding Initiative savings properties
2. THE Asana_Adapter SHALL map the Asana custom field for pipeline stage to one of the five valid Pipeline_Stage values (Identified, Validated, Negotiating, Implementing, Realized)
3. IF the Asana_Adapter encounters an unrecognized pipeline stage value, THEN THE Asana_Adapter SHALL log a warning and default the stage to "Identified"
4. THE Asana_Adapter SHALL record the sync timestamp (lastSyncedAt) on each initiative after a successful field mapping operation
5. IF the Asana_Adapter encounters a network error or authentication failure, THEN THE Asana_Adapter SHALL return a structured error object with error code and message without modifying initiative data

### Requirement 8: Asana Adapter — Sync Trigger

**User Story:** As a PMO lead, I want Asana data to sync on a scheduled basis and on demand, so that the dashboard always reflects recent project status.

#### Acceptance Criteria

1. WHEN a manual sync is requested, THE Asana_Adapter SHALL fetch current task data from the configured Asana project and update the InitiativeStore
2. WHEN the Lambda function receives a scheduled event, THE Asana_Adapter SHALL execute a full sync of all configured Asana projects
3. THE Asana_Adapter SHALL accept a configuration object specifying the Asana project ID, access token reference, and custom field mappings

### Requirement 9: Demo Fixture Data

**User Story:** As a developer, I want a fixture data module that provides realistic synthetic initiative and workstream data, so that the application can be demonstrated and tested without external service dependencies.

#### Acceptance Criteria

1. THE Demo_Fixture_Module SHALL export an array of 13 initiative objects matching the Initiative data model schema (id, name, workstream, owner, stage, savings object, dueDate, lastSyncedAt, createdAt, rag)
2. THE Demo_Fixture_Module SHALL export an array of 7 workstream summary objects with name, target, validated, realized, and rag properties
3. THE Demo_Fixture_Module SHALL contain data values matching the synthetic data defined in the demo HTML artifact (signal-engine-procurement-pmo-demo.html)
4. WHEN the application is running without a configured Asana connection, THE Demo_Fixture_Module SHALL serve as the default data source for all views

### Requirement 10: Deployment — Amplify Static Hosting

**User Story:** As an operator, I want the frontend deployed to AWS Amplify, so that the application is accessible over HTTPS without managing servers.

#### Acceptance Criteria

1. THE Deployment_Stack SHALL host all static frontend files (HTML, JS, CSS) via AWS Amplify Hosting connected to the GitHub repository
2. WHEN a commit is pushed to the main branch, THE Deployment_Stack SHALL trigger an automatic build and deploy of the static frontend
3. THE Deployment_Stack SHALL serve the application over HTTPS with a valid certificate

### Requirement 11: Deployment — Lambda API

**User Story:** As an operator, I want backend functions deployed as Lambda behind API Gateway, so that persistence and Asana sync run serverlessly.

#### Acceptance Criteria

1. THE Deployment_Stack SHALL deploy Lambda functions for initiative data persistence (read/write to S3 JSON store) and Asana sync operations
2. THE Deployment_Stack SHALL expose Lambda functions through API Gateway with HTTPS endpoints
3. THE Deployment_Stack SHALL configure Cognito user pool authentication on all API Gateway endpoints
4. IF a Lambda function exceeds its execution timeout, THEN THE Deployment_Stack SHALL return an HTTP 504 response to the caller

### Requirement 12: Deployment — Data Persistence

**User Story:** As an operator, I want initiative data persisted in S3 as JSON, so that data survives between sessions without a database.

#### Acceptance Criteria

1. THE Deployment_Stack SHALL store initiative data as a JSON file in a dedicated S3 bucket
2. WHEN a write operation is performed, THE Deployment_Stack SHALL overwrite the existing JSON file with the updated initiative array
3. WHEN a read operation is performed, THE Deployment_Stack SHALL return the current JSON file contents parsed as an initiative array
4. IF the S3 bucket is empty or the file does not exist, THEN THE Deployment_Stack SHALL return an empty array
