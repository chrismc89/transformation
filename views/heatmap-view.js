/**
 * Heatmap View — Workstream heatmap table showing health metrics.
 * @module views/heatmap-view
 */

import { formatMillions, formatPct, ragClass } from './view-manager.js';

/** RAG status labels for display */
const RAG_LABEL = { g: 'On Track', a: 'At Risk', r: 'Critical' };

/**
 * Render the workstream heatmap table.
 * @param {HTMLElement} container - Section element to render into
 * @param {object} ctx - Context object from view-manager
 * @param {Array} ctx.workstreams - Workstream summary objects (values in $M)
 * @param {Array} ctx.signals - Signal array from cascade engine
 * @param {Array} ctx.initiatives - All initiative objects
 */
export function renderHeatmap(container, { workstreams, signals, initiatives }) {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.innerHTML = `
    <div class="section-head">
      <h2>Workstream Heatmap</h2>
      <span class="note">RAG reflects worst signal within each workstream</span>
    </div>
  `;

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Workstream</th>
        <th>Initiatives</th>
        <th>Target</th>
        <th>Validated</th>
        <th>Realized</th>
        <th>% to Target</th>
        <th>RAG</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  const inits = initiatives || [];
  const sigs = signals || [];

  for (const ws of workstreams) {
    const count = inits.filter(i => i.workstream === ws.name).length;
    const rag = deriveWorkstreamRag(ws.name, inits, sigs);
    const pctRatio = ws.target > 0 ? ws.validated / ws.target : 0;
    const pctDisplay = formatPct(pctRatio);
    const cellColorClass = ragClass(rag);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${ws.name}</strong></td>
      <td class="num">${count}</td>
      <td class="num mono">${formatMillions(ws.target * 1_000_000)}</td>
      <td class="num mono">${formatMillions(ws.validated * 1_000_000)}</td>
      <td class="num mono">${formatMillions(ws.realized * 1_000_000)}</td>
      <td class="num mono ${cellColorClass}">${pctDisplay}</td>
      <td><span class="rag-dot ${rag}"></span>${RAG_LABEL[rag] || 'On Track'}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  section.appendChild(table);
  container.appendChild(section);
}

/**
 * Derive the RAG status for a workstream from signal priorities.
 * Logic:
 *  - Find all signals targeting initiatives in the workstream
 *  - If any signal is P1 → 'r' (red/critical)
 *  - Else if any signal is P2 → 'a' (amber/at-risk)
 *  - Else → 'g' (green/on-track)
 *
 * @param {string} workstreamName - Name of the workstream
 * @param {Array} initiatives - All initiative objects
 * @param {Array} signals - All signals from cascade engine
 * @returns {'r'|'a'|'g'} RAG status code
 */
function deriveWorkstreamRag(workstreamName, initiatives, signals) {
  // Get initiative IDs belonging to this workstream
  const wsInitIds = new Set(
    initiatives
      .filter(i => i.workstream === workstreamName)
      .map(i => i.id)
  );

  // Find worst (lowest number = highest priority) signal for this workstream
  let worstPriority = Infinity;

  for (const sig of signals) {
    if (wsInitIds.has(sig.initiativeId)) {
      if (sig.priority < worstPriority) {
        worstPriority = sig.priority;
      }
    }
  }

  if (worstPriority <= 1) return 'r';
  if (worstPriority <= 2) return 'a';
  return 'g';
}
