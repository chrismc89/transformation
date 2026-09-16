/**
 * App Entry Point — Initialization, data loading, signal cascade, and view rendering.
 * @module app
 */

import config from './config/app-config.js';
import { initiatives as fixtureInitiatives, programMeta } from './data/demo-fixtures.js';
import { initViews } from './views/view-manager.js';
import { runSignals, runPortfolioSignals } from './core/signal-cascade.js';
import { resolveAsOfDate } from './core/as-of-date.js';
import ProcurementBundle from './domains/procurement-bundle.js';
import ProgramBundle from './domains/program-bundle.js';
import InitiativeStore from './models/initiative-store.js';

/**
 * Main initialization flow:
 * 1. Check config: apiUrl defined?
 *    - No → load demo fixtures into InitiativeStore
 *    - Yes → fetch from API; on failure, fallback to demo fixtures
 * 2. Run signal cascade against all initiatives
 * 3. Derive workstream summaries
 * 4. Call ViewManager.initViews() to render all views
 */
async function init() {
  let initiativeData = null;

  // Step 1: Load data
  if (config.apiUrl) {
    try {
      const response = await fetch(config.apiUrl + '/initiatives');
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      initiativeData = await response.json();
      console.log('[App] Loaded initiative data from API');
    } catch (err) {
      console.warn('[App] API fetch failed, falling back to demo fixtures:', err.message);
      initiativeData = null;
    }
  }

  if (!initiativeData) {
    initiativeData = fixtureInitiatives;
    console.log('[App] Running in demo mode with fixture data');
  }

  InitiativeStore.load(initiativeData);

  // Step 2: Run signal cascade
  // Live API data uses wall-clock time; demo fixtures stay pinned to programMeta.weekOf
  const isLiveMode = Boolean(config.apiUrl && initiativeData !== fixtureInitiatives);
  const asOfDate = resolveAsOfDate(isLiveMode, programMeta.weekOf);

  const initiativeSignals = runSignals(InitiativeStore.getAll(), ProcurementBundle, { asOfDate });
  const signals = runPortfolioSignals(InitiativeStore.getAll(), initiativeSignals, ProgramBundle, { asOfDate });
  console.log(`[App] Signal cascade produced ${signals.length} signals`);

  // Step 3: Update header metadata
  updateHeaderMeta();

  // Step 4: Initialize views
  const containerEl = document.getElementById('app-views');
  if (containerEl) {
    initViews(containerEl, InitiativeStore, signals);
    console.log('[App] Views initialized');
  } else {
    console.error('[App] Could not find #app-views container');
  }
}

/**
 * Update the header metadata span with program day/week info from fixtures.
 */
function updateHeaderMeta() {
  const metaEl = document.getElementById('meta-info');
  if (metaEl && programMeta) {
    const weekDate = new Date(programMeta.weekOf + 'T00:00:00Z');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${monthNames[weekDate.getUTCMonth()]} ${weekDate.getUTCDate()}, ${weekDate.getUTCFullYear()}`;
    metaEl.textContent = `Program Day ${programMeta.day} of ${programMeta.totalDays} · Week of ${formatted}`;
  }
}

// Boot the application
init().catch(err => {
  console.error('[App] Initialization failed:', err);
});
