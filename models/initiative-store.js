/**
 * InitiativeStore — Data model for procurement transformation initiatives.
 * @module models/initiative-store
 */

const InitiativeStore = {
  _initiatives: [],

  load(data) { this._initiatives = data || []; },
  getAll() { return this._initiatives; },
  getById(id) { return this._initiatives.find(i => i.id === id) || null; },
  getByWorkstream(ws) { return this._initiatives.filter(i => i.workstream === ws); },
  getAtRisk() { return this._initiatives.filter(i => i.rag === 'r' || i.rag === 'a'); },

  getSummary() {
    const all = this._initiatives;
    return {
      count: all.length,
      totalTarget: all.reduce((s, i) => s + (i.savings?.target || 0), 0),
      totalValidated: all.reduce((s, i) => s + (i.savings?.validated || 0), 0),
      totalRealized: all.reduce((s, i) => s + (i.savings?.realized || 0), 0),
      workstreams: [...new Set(all.map(i => i.workstream))].length,
      atRiskCount: all.filter(i => i.rag === 'r' || i.rag === 'a').length,
    };
  }
};

export default InitiativeStore;
