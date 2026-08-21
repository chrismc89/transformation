/**
 * Program Signal Bundle — Portfolio-level evaluators for cross-initiative risk.
 * @module domains/program-bundle
 */

const thresholds = {
  ownerConcentrationCount: 2,   // # of at-risk initiatives before flagging
  atRiskPriority: 2,            // signals at this priority or better count as "at-risk"
};

const evaluators = [
  {
    id: 'owner-concentration',
    evaluate(ctx, thr) {
      const { initiatives, signals } = ctx;
      const atRiskIdsByOwner = new Map();

      for (const sig of signals) {
        if (sig.priority > thr.atRiskPriority || !sig.initiativeId) continue;
        const init = initiatives.find(i => i.id === sig.initiativeId);
        if (!init) continue;
        if (!atRiskIdsByOwner.has(init.owner)) atRiskIdsByOwner.set(init.owner, new Set());
        atRiskIdsByOwner.get(init.owner).add(init.id);
      }

      const out = [];
      for (const [owner, ids] of atRiskIdsByOwner) {
        if (ids.size < thr.ownerConcentrationCount) continue;
        const exposure = initiatives
          .filter(i => ids.has(i.id))
          .reduce((sum, i) => sum + (i.savings?.target || 0), 0);

        out.push({
          priority: 4,
          id: 'owner-concentration',
          initiativeId: null,
          title: `Owner concentration risk — ${owner}`,
          consequence: `${owner} owns ${ids.size} at-risk initiatives totaling $${(exposure / 1e6).toFixed(1)}M of pipeline exposure.`,
          action: `Review capacity with ${owner} or reassign one workstream.`,
        });
      }
      return out;
    }
  }
];

const ProgramBundle = { thresholds, evaluators };
export default ProgramBundle;
