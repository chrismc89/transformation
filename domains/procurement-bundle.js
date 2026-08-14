/**
 * Procurement Signal Bundle — Domain evaluators for savings pipeline.
 * @module domains/procurement-bundle
 */

const thresholds = {
  staleActivityDays: 14,
  pipelineStaleDays: 21,
  validationGapPct: 0.75,
  pacingTolerancePct: 0.10,
  ownerConcentrationPct: 0.40,
  forecastDeltaPct: 0.08,
};

const evaluators = [
  {
    id: 'critical-initiative-overdue',
    evaluate(ctx, thr) {
      const { initiative, asOfDate } = ctx;
      const now = asOfDate ? new Date(asOfDate) : new Date();
      if (!initiative.dueDate) return [];
      const due = new Date(initiative.dueDate);
      const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0 && (initiative.savings?.realized || 0) < (initiative.savings?.target || 0)) {
        return [{ priority: 1, id: 'critical-initiative-overdue', initiativeId: initiative.id,
          title: 'Critical initiative overdue — ' + initiative.name,
          consequence: 'Due date passed ' + daysOverdue + ' days ago. Savings not realized.',
          action: 'Escalate to ' + initiative.owner + ' or reassign owner today.' }];
      }
      return [];
    }
  },
  {
    id: 'validation-gap-at-risk',
    evaluate(ctx, thr) {
      const { initiative } = ctx;
      const target = initiative.savings?.target || 0;
      const validated = initiative.savings?.validated || 0;
      if (target === 0) return [];
      const pct = validated / target;
      if (pct < thr.validationGapPct && initiative.stage === 'negotiating') {
        const gap = target - validated;
        return [{ priority: 1, id: 'validation-gap-at-risk', initiativeId: initiative.id,
          title: 'Validation gap at risk — ' + initiative.name,
          consequence: '$' + (gap / 1e6).toFixed(1) + 'M of claimed savings unsupported by Finance.',
          action: 'Schedule Finance validation review before next steering committee.' }];
      }
      return [];
    }
  },
  {
    id: 'pipeline-stalled',
    evaluate(ctx, thr) {
      const { initiative, asOfDate } = ctx;
      if (!initiative.lastSyncedAt) return [];
      const now = asOfDate ? new Date(asOfDate) : new Date();
      const daysSince = Math.floor((now - new Date(initiative.lastSyncedAt)) / (1000 * 60 * 60 * 24));
      if (daysSince > thr.pipelineStaleDays && initiative.stage !== 'realized') {
        return [{ priority: 2, id: 'pipeline-stalled', initiativeId: initiative.id,
          title: 'Pipeline stalled — ' + initiative.name,
          consequence: 'No activity in ' + daysSince + ' days. Stage: ' + initiative.stage + '.',
          action: 'Confirm owner capacity or pull forward next milestone.' }];
      }
      return [];
    }
  },
  {
    id: 'stale-asana-update',
    evaluate(ctx, thr) {
      const { initiative, asOfDate } = ctx;
      if (!initiative.lastSyncedAt) return [];
      const now = asOfDate ? new Date(asOfDate) : new Date();
      const daysSince = Math.floor((now - new Date(initiative.lastSyncedAt)) / (1000 * 60 * 60 * 24));
      if (daysSince > thr.staleActivityDays && daysSince <= thr.pipelineStaleDays) {
        return [{ priority: 2, id: 'stale-asana-update', initiativeId: initiative.id,
          title: 'Stale Asana update — ' + initiative.name,
          consequence: 'No task activity in ' + daysSince + ' days. Pipeline confidence degraded.',
          action: 'Request status refresh from ' + initiative.owner + '.' }];
      }
      return [];
    }
  },
  {
    id: 'behind-pace',
    evaluate(ctx, thr) {
      const { initiative, asOfDate } = ctx;
      const target = initiative.savings?.target || 0;
      const realized = initiative.savings?.realized || 0;
      if (target === 0 || !initiative.dueDate || !initiative.createdAt) return [];
      const now = asOfDate ? new Date(asOfDate) : new Date();
      const start = new Date(initiative.createdAt);
      const end = new Date(initiative.dueDate);
      const elapsed = (now - start) / (end - start);
      const realizedPct = realized / target;
      if (elapsed > 0.3 && realizedPct < (elapsed - thr.pacingTolerancePct)) {
        return [{ priority: 3, id: 'behind-pace', initiativeId: initiative.id,
          title: 'Behind pace — ' + initiative.name,
          consequence: Math.round(realizedPct * 100) + '% realized vs. ' + Math.round(elapsed * 100) + '% elapsed.',
          action: 'Review implementation schedule with ' + initiative.owner + '.' }];
      }
      return [];
    }
  },
  {
    id: 'owner-concentration',
    evaluate(ctx, thr) { return []; } // Portfolio-level — run separately
  },
  {
    id: 'forecast-delta',
    evaluate(ctx, thr) {
      const { initiative } = ctx;
      if (!initiative.priorValidated || initiative.priorValidated === 0) return [];
      const current = initiative.savings?.validated || 0;
      const delta = Math.abs(current - initiative.priorValidated) / initiative.priorValidated;
      if (delta > thr.forecastDeltaPct) {
        const direction = current > initiative.priorValidated ? 'up' : 'down';
        return [{ priority: 5, id: 'forecast-delta', initiativeId: initiative.id,
          title: 'Forecast delta — ' + initiative.name,
          consequence: 'Validated estimate moved ' + Math.round(delta * 100) + '% ' + direction + ' since last review.',
          action: 'Confirm driver before rolling into ELT deck.' }];
      }
      return [];
    }
  },
];

const ProcurementBundle = { thresholds, evaluators };
export default ProcurementBundle;
