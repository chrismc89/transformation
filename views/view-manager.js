/**
 * View Manager — Orchestrates view rendering and provides shared utilities.
 * @module views/view-manager
 */

import { renderDashboard } from './dashboard-view.js';
import { renderHeatmap } from './heatmap-view.js';
import { renderPipeline } from './pipeline-view.js';
import { renderELTExport } from './elt-export-view.js';

// Internal state
let _containerEl = null;
let _store = null;
let _signalEngine = null;

/**
 * Initialize the view manager and render all views.
 * @param {HTMLElement} containerEl - Root container element for views
 * @param {object} store - InitiativeStore instance
 * @param {object} signalEngine - Signal cascade output (array of signals)
 */
export function initViews(containerEl, store, signalEngine) {
  _containerEl = containerEl;
  _store = store;
  _signalEngine = signalEngine;

  refreshAll();
}

/**
 * Re-render all views with current store and signal data.
 */
export function refreshAll() {
  renderView('dashboard');
  renderView('heatmap');
  renderView('pipeline');
  renderView('elt');
}

/**
 * Render a specific view by name.
 * @param {'dashboard' | 'heatmap' | 'pipeline' | 'elt'} viewName
 */
export function renderView(viewName) {
  if (!_containerEl || !_store) return;

  const context = {
    store: _store,
    signals: _signalEngine || [],
    workstreams: _buildWorkstreams(),
    initiatives: _store.getAll(),
    summary: _store.getSummary(),
    thresholds: { staleActivityDays: 7 },
  };

  switch (viewName) {
    case 'dashboard':
      if (renderDashboard) {
        const el = _getOrCreateSection('dashboard');
        renderDashboard(el, context);
      }
      break;
    case 'heatmap':
      if (renderHeatmap) {
        const el = _getOrCreateSection('heatmap');
        renderHeatmap(el, context);
      }
      break;
    case 'pipeline':
      if (renderPipeline) {
        const el = _getOrCreateSection('pipeline');
        renderPipeline(el, context);
      }
      break;
    case 'elt':
      if (renderELTExport) {
        const el = _getOrCreateSection('elt');
        renderELTExport(el, context);
      }
      break;
    default:
      console.warn(`[ViewManager] Unknown view: ${viewName}`);
  }
}

// ─── Shared Utility Functions ───────────────────────────────────────────────

/**
 * Format a numeric value as abbreviated millions with dollar sign.
 * @param {number} value - Dollar amount (e.g., 3200000)
 * @returns {string} Formatted string (e.g., "$3.20M")
 */
export function formatMillions(value) {
  if (value == null || isNaN(value)) return '$0.00M';
  const millions = value / 1_000_000;
  return `$${millions.toFixed(2)}M`;
}

/**
 * Format a ratio as a whole-number percentage string.
 * @param {number} ratio - Decimal ratio (e.g., 0.76)
 * @returns {string} Formatted percentage (e.g., "76%")
 */
export function formatPct(ratio) {
  if (ratio == null || isNaN(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Map a RAG status letter to a CSS class name.
 * @param {'r' | 'a' | 'g'} rag - RAG status
 * @returns {string} CSS class (e.g., "cell-r")
 */
export function ragClass(rag) {
  const valid = ['r', 'a', 'g'];
  if (!rag || !valid.includes(rag)) return 'cell-g';
  return `cell-${rag}`;
}

/**
 * Derive RAG status for a single initiative from the current signal set.
 * P1 → 'r' (red), P2 → 'a' (amber), else → 'g' (green).
 * @param {string} initiativeId - The initiative ID to check
 * @param {Array} signals - Full signal array from cascade engine
 * @returns {'r'|'a'|'g'} RAG status code
 */
export function deriveInitiativeRag(initiativeId, signals) {
  const own = signals.filter(s => s.initiativeId === initiativeId);
  if (own.some(s => s.priority === 1)) return 'r';
  if (own.some(s => s.priority === 2)) return 'a';
  return 'g';
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Build workstream summary objects from current store data.
 * Groups initiatives by workstream and aggregates savings.
 */
function _buildWorkstreams() {
  const initiatives = _store.getAll();
  const wsMap = new Map();

  for (const init of initiatives) {
    const ws = init.workstream;
    if (!wsMap.has(ws)) {
      wsMap.set(ws, { name: ws, target: 0, validated: 0, realized: 0, initiatives: [] });
    }
    const entry = wsMap.get(ws);
    entry.target += init.savings?.target || 0;
    entry.validated += init.savings?.validated || 0;
    entry.realized += init.savings?.realized || 0;
    entry.initiatives.push(init);
  }

  return [...wsMap.values()].map(ws => ({
    name: ws.name,
    target: ws.target / 1_000_000,
    validated: ws.validated / 1_000_000,
    realized: ws.realized / 1_000_000,
  }));
}

/**
 * Get or create a section element within the container for a given view.
 */
function _getOrCreateSection(viewName) {
  let section = _containerEl.querySelector(`[data-view="${viewName}"]`);
  if (!section) {
    section = document.createElement('section');
    section.setAttribute('data-view', viewName);
    _containerEl.appendChild(section);
  }
  return section;
}
