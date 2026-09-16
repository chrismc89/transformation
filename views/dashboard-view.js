/**
 * Dashboard View — KPI strip, signal feed, and workstream savings chart.
 * @module views/dashboard-view
 */

import { formatMillions, formatPct } from './view-manager.js';
import config from '../config/app-config.js';

/** FY commitment used for pacing calculation */
const FY_COMMITMENT = config.fyCommitment;

/** Reference to the active Chart.js instance (for re-render cleanup) */
let _chartInstance = null;

/**
 * Render the full dashboard: KPI strip, signal feed, and workstream chart.
 * @param {HTMLElement} container - Section element to render into
 * @param {object} ctx - Context object from view-manager
 * @param {object} ctx.store - InitiativeStore instance
 * @param {Array} ctx.signals - Signal array from cascade engine
 * @param {Array} ctx.workstreams - Workstream summary objects (values in $M)
 * @param {Array} ctx.initiatives - All initiative objects
 * @param {object} ctx.summary - store.getSummary() result
 */
export function renderDashboard(container, { store, signals, workstreams, initiatives, summary }) {
  container.innerHTML = '';

  renderKPIStrip(container, summary, signals, initiatives);
  renderSignalFeed(container, signals);
  renderWorkstreamChart(container, workstreams);
}

// ─── KPI Strip ──────────────────────────────────────────────────────────────

/**
 * Render the five KPI metric cards.
 */
function renderKPIStrip(container, summary, signals, initiatives) {
  const atRiskTotal = computeAtRiskTotal(signals, initiatives);
  const pacingRatio = summary.totalRealized / FY_COMMITMENT;

  const kpis = [
    {
      label: 'Pipeline Identified',
      value: formatMillions(summary.totalTarget),
      foot: `${summary.count} initiatives`,
      accent: '',
    },
    {
      label: 'Finance-Validated',
      value: formatMillions(summary.totalValidated),
      foot: `${formatPct(summary.totalTarget ? summary.totalValidated / summary.totalTarget : 0)} of pipeline`,
      accent: '',
    },
    {
      label: 'Realized to Date',
      value: formatMillions(summary.totalRealized),
      foot: `${formatPct(summary.totalTarget ? summary.totalRealized / summary.totalTarget : 0)} of pipeline`,
      accent: 'accent-green',
    },
    {
      label: 'At Risk (P1/P2)',
      value: formatMillions(atRiskTotal),
      foot: `${countAtRiskInitiatives(signals, initiatives)} initiatives flagged`,
      accent: 'accent-red',
    },
    {
      label: 'Program Pacing',
      value: formatPct(pacingRatio),
      foot: `vs ${formatMillions(FY_COMMITMENT)} FY target`,
      accent: pacingRatio >= 0.5 ? 'accent-green' : 'accent-amber',
    },
  ];

  const strip = document.createElement('div');
  strip.className = 'kpis';

  for (const kpi of kpis) {
    const card = document.createElement('div');
    card.className = `kpi ${kpi.accent}`.trim();
    card.innerHTML = `
      <div class="label">${kpi.label}</div>
      <div class="value mono">${kpi.value}</div>
      <div class="foot">${kpi.foot}</div>
    `;
    strip.appendChild(card);
  }

  container.appendChild(strip);
}

/**
 * Compute the total at-risk savings (sum of savings.target for initiatives with P1 or P2 signals).
 */
function computeAtRiskTotal(signals, initiatives) {
  const atRiskIds = new Set();
  for (const sig of signals) {
    if (sig.priority <= 2) {
      atRiskIds.add(sig.initiativeId);
    }
  }

  let total = 0;
  for (const init of initiatives) {
    if (atRiskIds.has(init.id)) {
      total += init.savings?.target || 0;
    }
  }
  return total;
}

/**
 * Count distinct initiatives with P1 or P2 signals.
 */
function countAtRiskInitiatives(signals, initiatives) {
  const atRiskIds = new Set();
  for (const sig of signals) {
    if (sig.priority <= 2) {
      atRiskIds.add(sig.initiativeId);
    }
  }
  return atRiskIds.size;
}

// ─── Signal Feed ────────────────────────────────────────────────────────────

/** Default feed shows only P1/P2 — the items that require action this cycle. */
const SIGNAL_FEED_DEFAULT_MAX_PRIORITY = 2;

/**
 * Split signals into the default feed (P1/P2) and lower-priority remainder.
 * @param {Array} signals
 * @returns {{ primary: Array, more: Array }}
 */
export function partitionSignals(signals) {
  const sorted = [...(signals || [])].sort((a, b) => a.priority - b.priority);
  return {
    primary: sorted.filter((s) => s.priority <= SIGNAL_FEED_DEFAULT_MAX_PRIORITY),
    more: sorted.filter((s) => s.priority > SIGNAL_FEED_DEFAULT_MAX_PRIORITY),
  };
}

function renderSignalEl(sig) {
  const el = document.createElement('div');
  el.className = `signal p${sig.priority}`;
  el.innerHTML = `
    <span class="tag">P${sig.priority}</span>
    <div class="body">
      <div class="title">${sig.title}</div>
      <div class="desc">${sig.consequence || sig.description || ''}</div>
      <div class="action">↳ ${sig.action}</div>
    </div>
  `;
  return el;
}

/**
 * Render the signal feed: P1/P2 by default, with a toggle for P3–P5.
 */
function renderSignalFeed(container, signals) {
  const { primary, more } = partitionSignals(signals);

  const section = document.createElement('section');
  section.className = 'signal-feed';
  section.innerHTML = `
    <div class="section-head">
      <h2>Signal Feed</h2>
      <span class="note">P1/P2 by default · sorted by priority</span>
    </div>
  `;

  if (primary.length === 0 && more.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'signal';
    empty.innerHTML = `
      <div class="body">
        <div class="title">No active signals</div>
        <div class="desc">All initiatives are tracking within normal parameters.</div>
      </div>
    `;
    section.appendChild(empty);
    container.appendChild(section);
    return;
  }

  const primaryWrap = document.createElement('div');
  primaryWrap.className = 'signal-feed-primary';
  if (primary.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'signal';
    empty.innerHTML = `
      <div class="body">
        <div class="title">No P1/P2 signals</div>
        <div class="desc">Nothing requires ELT attention this cycle. Lower-priority items are available below.</div>
      </div>
    `;
    primaryWrap.appendChild(empty);
  } else {
    for (const sig of primary) primaryWrap.appendChild(renderSignalEl(sig));
  }
  section.appendChild(primaryWrap);

  if (more.length > 0) {
    const extra = document.createElement('div');
    extra.className = 'signal-feed-more';
    extra.hidden = true;
    extra.id = 'signal-feed-more';
    for (const sig of more) extra.appendChild(renderSignalEl(sig));
    section.appendChild(extra);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'signal-feed-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'signal-feed-more');
    const noun = more.length === 1 ? 'signal' : 'signals';
    const collapsedLabel = `Show ${more.length} lower-priority ${noun} (P3–P5)`;
    const expandedLabel = 'Show fewer signals';
    toggle.textContent = collapsedLabel;
    toggle.addEventListener('click', () => {
      const expand = extra.hidden;
      extra.hidden = !expand;
      toggle.setAttribute('aria-expanded', String(expand));
      toggle.textContent = expand ? expandedLabel : collapsedLabel;
    });
    section.appendChild(toggle);
  }

  container.appendChild(section);
}

// ─── Workstream Savings Chart ───────────────────────────────────────────────

/**
 * Render a Chart.js grouped bar chart showing target/validated/realized per workstream.
 */
function renderWorkstreamChart(container, workstreams) {
  const section = document.createElement('section');
  section.innerHTML = `
    <div class="section-head">
      <h2>Workstream Savings</h2>
      <span class="note">Target vs Validated vs Realized ($M)</span>
    </div>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';

  // Check if Chart.js is available (loaded via CDN)
  if (typeof Chart === 'undefined') {
    wrap.innerHTML = '<p style="color:var(--ink-soft);padding-top:60px;text-align:center;">Chart unavailable — Chart.js not loaded.</p>';
    section.appendChild(wrap);
    container.appendChild(section);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'workstream-chart';
  wrap.appendChild(canvas);
  section.appendChild(wrap);
  container.appendChild(section);

  // Destroy previous chart instance if re-rendering
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  const labels = workstreams.map(ws => ws.name);
  const targetData = workstreams.map(ws => ws.target);
  const validatedData = workstreams.map(ws => ws.validated);
  const realizedData = workstreams.map(ws => ws.realized);

  _chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Target',
          data: targetData,
          backgroundColor: '#1A2332',
        },
        {
          label: 'Validated',
          data: validatedData,
          backgroundColor: '#C47700',
        },
        {
          label: 'Realized',
          data: realizedData,
          backgroundColor: '#3F6B4F',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'Inter', sans-serif", size: 11 },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Savings ($M)',
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
          },
        },
        x: {
          ticks: {
            font: { family: "'Inter', sans-serif", size: 10 },
            maxRotation: 45,
          },
        },
      },
    },
  });
}
