/**
 * ELT Export View — Steering committee summary card with narrative and export.
 * @module views/elt-export-view
 */

import { formatMillions, formatPct } from './view-manager.js';
import config from '../config/app-config.js';

/**
 * Render the ELT steering committee summary card.
 * @param {HTMLElement} container - Section element to render into
 * @param {object} ctx - Context object from view-manager
 * @param {object} ctx.summary - store.getSummary() result
 * @param {Array} ctx.signals - Signal array from cascade engine
 * @param {Array} ctx.initiatives - All initiative objects
 */
export function renderELTExport(container, { summary, signals, initiatives }) {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.innerHTML = `<div class="section-head"><h2>ELT Export</h2></div>`;

  const card = document.createElement('div');
  card.className = 'brief-card';

  // Title
  const heading = document.createElement('h3');
  heading.textContent = 'Steering Committee Summary';
  card.appendChild(heading);

  // Narrative paragraph — pipeline status
  const narrativePara = document.createElement('p');
  narrativePara.innerHTML = buildNarrative(summary);
  card.appendChild(narrativePara);

  // P1 attention paragraph
  const p1Initiatives = getP1Initiatives(signals, initiatives);
  if (p1Initiatives.length > 0) {
    const attentionPara = document.createElement('p');
    attentionPara.innerHTML = buildAttentionNarrative(p1Initiatives, signals);
    card.appendChild(attentionPara);
  }

  // Statistics row
  const p1p2Count = countP1P2Signals(signals);
  const statRow = document.createElement('div');
  statRow.className = 'stat-row';
  statRow.innerHTML = `
    <div class="stat"><div class="n">${p1p2Count}</div><div class="l">Open P1/P2</div></div>
    <div class="stat"><div class="n">${summary.workstreams}</div><div class="l">Workstreams</div></div>
    <div class="stat"><div class="n">${summary.count}</div><div class="l">Initiatives</div></div>
  `;
  card.appendChild(statRow);

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'export-btn';
  exportBtn.textContent = 'Download print-ready brief (HTML)';
  exportBtn.addEventListener('click', () => {
    generateExport(summary, signals, initiatives);
  });
  card.appendChild(exportBtn);

  section.appendChild(card);
  container.appendChild(section);
}

// ─── Narrative Helpers ──────────────────────────────────────────────────────

/**
 * Build the main narrative paragraph describing pipeline status.
 * @param {object} summary - Store summary object
 * @returns {string} HTML string with strong-highlighted values
 */
function buildNarrative(summary) {
  const identified = formatMillions(summary.totalTarget);
  const validatedPct = formatPct(summary.totalTarget ? summary.totalValidated / summary.totalTarget : 0);
  const realized = formatMillions(summary.totalRealized);
  const fyCommitment = formatMillions(config.fyCommitment);

  return `Procurement transformation pipeline stands at <strong style="color:#fff">${identified}</strong> identified, <strong style="color:#fff">${validatedPct} validated</strong> by Finance, and <strong style="color:#fff">${realized} realized</strong> against a ${fyCommitment} FY run-rate commitment.`;
}

/**
 * Build the attention paragraph listing P1 initiatives by name.
 * @param {Array} p1Initiatives - Initiatives with P1 signals
 * @param {Array} signals - All signals
 * @returns {string} HTML string
 */
function buildAttentionNarrative(p1Initiatives, signals) {
  const count = p1Initiatives.length;
  const countWord = count === 1 ? 'One initiative requires' : `${count} initiatives require`;

  const names = p1Initiatives.map(init => {
    return `<strong style="color:#fff">${init.name}</strong>`;
  });

  const nameList = names.length <= 2
    ? names.join(' and ')
    : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];

  return `${countWord} ELT attention this cycle: ${nameList}.`;
}

// ─── Data Helpers ───────────────────────────────────────────────────────────

/**
 * Get initiatives that have active P1 signals.
 * @param {Array} signals - Signal array
 * @param {Array} initiatives - Initiative array
 * @returns {Array} Initiatives with P1 signals
 */
function getP1Initiatives(signals, initiatives) {
  const p1Ids = new Set();
  for (const sig of signals) {
    if (sig.priority === 1) {
      p1Ids.add(sig.initiativeId);
    }
  }
  return initiatives.filter(init => p1Ids.has(init.id));
}

/**
 * Count distinct P1/P2 signals.
 * @param {Array} signals - Signal array
 * @returns {number} Count of P1 and P2 signals
 */
function countP1P2Signals(signals) {
  return signals.filter(sig => sig.priority <= 2).length;
}

// ─── Export Generation ──────────────────────────────────────────────────────

/**
 * Generate and download a print-ready HTML export of the steering committee summary.
 * @param {object} summary - Store summary object
 * @param {Array} signals - Signal array
 * @param {Array} initiatives - Initiative array
 */
function generateExport(summary, signals, initiatives) {
  const p1Initiatives = getP1Initiatives(signals, initiatives);
  const p1p2Count = countP1P2Signals(signals);
  const narrativeHtml = buildNarrative(summary);
  const attentionHtml = p1Initiatives.length > 0
    ? `<p>${buildAttentionNarrative(p1Initiatives, signals)}</p>`
    : '';

  // P1/P2 action items
  const p1p2Signals = signals.filter(sig => sig.priority <= 2);
  const actionItemsHtml = p1p2Signals.length > 0
    ? `
      <h2>Action Items (P1/P2)</h2>
      <table>
        <thead><tr><th>Priority</th><th>Signal</th><th>Action</th></tr></thead>
        <tbody>
          ${p1p2Signals.map(sig => `
            <tr>
              <td><strong>P${sig.priority}</strong></td>
              <td>${sig.title}</td>
              <td>${sig.action}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Steering Committee Summary — Procurement Transformation</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 1in; }
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1A2332;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 32px;
      line-height: 1.6;
    }
    h1 {
      font-size: 22px;
      border-bottom: 2px solid #1A2332;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 16px;
      color: #26314A;
      margin-top: 28px;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      margin: 0 0 12px;
    }
    strong {
      color: #1A2332;
    }
    .stat-row {
      display: flex;
      gap: 32px;
      margin: 20px 0;
    }
    .stat {
      text-align: center;
    }
    .stat .n {
      font-size: 28px;
      font-weight: 700;
      color: #1A2332;
    }
    .stat .l {
      font-size: 11px;
      color: #5B6270;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 8px;
    }
    th {
      background: #1A2332;
      color: #fff;
      text-align: left;
      padding: 8px 10px;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E3E1DA;
    }
    tr:nth-child(even) td {
      background: #F6F5F2;
    }
    .footer {
      margin-top: 40px;
      font-size: 11px;
      color: #5B6270;
      border-top: 1px solid #E3E1DA;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  <h1>Steering Committee Summary</h1>
  <p>${narrativeHtml.replace(/<strong style="color:#fff">/g, '<strong>')}</p>
  ${attentionHtml.replace(/<strong style="color:#fff">/g, '<strong>')}

  <h2>Key Statistics</h2>
  <div class="stat-row">
    <div class="stat"><div class="n">${p1p2Count}</div><div class="l">Open P1/P2</div></div>
    <div class="stat"><div class="n">${summary.workstreams}</div><div class="l">Workstreams</div></div>
    <div class="stat"><div class="n">${summary.count}</div><div class="l">Initiatives</div></div>
  </div>

  ${actionItemsHtml}

  <div class="footer">
    Generated ${new Date().toISOString().split('T')[0]} · Signal Engine — Procurement Transformation PMO
  </div>
</body>
</html>`;

  // Trigger browser download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `steering-committee-summary-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
