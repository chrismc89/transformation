/**
 * Pipeline View — Initiative pipeline table with stage badges and sync status.
 * @module views/pipeline-view
 */

import { formatMillions, deriveInitiativeRag, RAG_LABEL } from './view-manager.js';

/** Map pipeline stage to its CSS class suffix */
const STAGE_CLASS = {
  identified: 'stage-identified',
  validated: 'stage-validated',
  negotiating: 'stage-negotiating',
  implementing: 'stage-implementing',
  realized: 'stage-realized',
};

/** Display labels for pipeline stages */
const STAGE_LABEL = {
  identified: 'Identified',
  validated: 'Validated',
  negotiating: 'Negotiating',
  implementing: 'Implementing',
  realized: 'Realized',
};

/**
 * Format an ISO date string to YYYY-MM-DD display format.
 * Returns '—' if the value is missing.
 * @param {string|null} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  // Extract YYYY-MM-DD portion from ISO string
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/**
 * Determine if a sync timestamp is stale based on the threshold.
 * @param {string|null} lastSyncedAt - ISO timestamp of last sync
 * @param {number} staleActivityDays - Number of days before considered stale
 * @returns {boolean} True if sync is stale (or missing)
 */
function isSyncStale(lastSyncedAt, staleActivityDays) {
  if (!lastSyncedAt) return true;
  const syncDate = new Date(lastSyncedAt);
  if (isNaN(syncDate.getTime())) return true;
  const now = new Date();
  const diffMs = now - syncDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > staleActivityDays;
}

/**
 * Render the initiative pipeline table.
 * @param {HTMLElement} container - Section element to render into
 * @param {object} ctx - Context object from view-manager
 * @param {Array} ctx.initiatives - All initiative objects
 * @param {object} ctx.thresholds - Threshold config (staleActivityDays)
 */
export function renderPipeline(container, { initiatives, thresholds, signals }) {
  container.innerHTML = '';

  const staleActivityDays = thresholds?.staleActivityDays ?? 7;
  const inits = initiatives || [];

  const section = document.createElement('section');
  section.innerHTML = `
    <div class="section-head">
      <h2>Initiative Pipeline</h2>
      <span class="note">${inits.length} initiatives tracked</span>
    </div>
  `;

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Initiative</th>
        <th>RAG</th>
        <th>Owner</th>
        <th>Stage</th>
        <th>Target</th>
        <th>Validated</th>
        <th>Realized</th>
        <th>Due Date</th>
        <th>Asana Sync</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  for (const init of inits) {
    const rag = deriveInitiativeRag(init.id, signals || []);
    const ragLabel = RAG_LABEL[rag] || RAG_LABEL.g;
    const stage = (init.stage || 'identified').toLowerCase();
    const stageClass = STAGE_CLASS[stage] || STAGE_CLASS.identified;
    const stageLabel = STAGE_LABEL[stage] || STAGE_LABEL.identified;

    const target = formatMillions(init.savings?.target || 0);
    const validated = formatMillions(init.savings?.validated || 0);
    const realized = formatMillions(init.savings?.realized || 0);

    const dueDate = formatDate(init.dueDate);
    const syncDate = formatDate(init.lastSyncedAt);
    const stale = isSyncStale(init.lastSyncedAt, staleActivityDays);
    const syncBadgeClass = stale ? 'asana-badge stale' : 'asana-badge';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Initiative" data-primary>${init.name || ''}</td>
      <td data-label="RAG"><span class="rag-dot ${rag}"></span>${ragLabel}</td>
      <td data-label="Owner">${init.owner || '—'}</td>
      <td data-label="Stage"><span class="stage-badge ${stageClass}">${stageLabel}</span></td>
      <td data-label="Target" class="num mono">${target}</td>
      <td data-label="Validated" class="num mono">${validated}</td>
      <td data-label="Realized" class="num mono">${realized}</td>
      <td data-label="Due Date" class="mono">${dueDate}</td>
      <td data-label="Asana Sync"><span class="${syncBadgeClass}"><span class="dot"></span>${syncDate}</span></td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  section.appendChild(table);
  container.appendChild(section);
}
