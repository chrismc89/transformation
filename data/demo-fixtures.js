/**
 * Demo Fixture Data — Synthetic initiative and workstream data
 * matching the demo HTML (signal-engine-procurement-pmo-demo.html).
 *
 * Totals: ~$18.8M target, ~$14.3M validated, ~$5.35M realized
 *
 * @module data/demo-fixtures
 */

/**
 * 13 initiative objects conforming to the Initiative data model schema.
 * Values sourced from the demo HTML synthetic data.
 */
export const initiatives = [
  {
    id: 'init-001',
    name: 'Steel/Alloy Supplier Consolidation',
    workstream: 'Direct Materials',
    owner: 'J. Alvarez',
    stage: 'implementing',
    savings: {
      baseline: 3200000,
      target: 3200000,
      validated: 2900000,
      realized: 1400000,
    },
    dueDate: '2026-10-15',
    asanaProjectId: 'proj_001',
    lastSyncedAt: '2026-08-12T10:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-002',
    name: 'Resin & Packaging Substrate Rebid',
    workstream: 'Direct Materials',
    owner: 'J. Alvarez',
    stage: 'negotiating',
    savings: {
      baseline: 1100000,
      target: 1100000,
      validated: 600000,
      realized: 0,
    },
    dueDate: '2026-09-30',
    asanaProjectId: 'proj_002',
    lastSyncedAt: '2026-08-13T10:00:00Z',
    createdAt: '2026-01-20T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-003',
    name: 'MRO Spend Consolidation (VMI)',
    workstream: 'Indirect / MRO',
    owner: 'T. Nakamura',
    stage: 'validated',
    savings: {
      baseline: 850000,
      target: 850000,
      validated: 850000,
      realized: 0,
    },
    dueDate: '2026-11-01',
    asanaProjectId: 'proj_003',
    lastSyncedAt: '2026-08-11T10:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-004',
    name: 'Spare Parts Rationalization',
    workstream: 'Indirect / MRO',
    owner: 'T. Nakamura',
    stage: 'identified',
    savings: {
      baseline: 400000,
      target: 400000,
      validated: 0,
      realized: 0,
    },
    dueDate: '2026-12-15',
    asanaProjectId: 'proj_004',
    lastSyncedAt: '2026-07-27T10:00:00Z',
    createdAt: '2026-02-10T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-005',
    name: 'Freight Carrier RFP (Combined Network)',
    workstream: 'Logistics & Freight',
    owner: 'S. Whitfield',
    stage: 'implementing',
    savings: {
      baseline: 2400000,
      target: 2400000,
      validated: 2200000,
      realized: 1900000,
    },
    dueDate: '2026-09-01',
    asanaProjectId: 'proj_005',
    lastSyncedAt: '2026-08-13T10:00:00Z',
    createdAt: '2026-01-18T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-006',
    name: 'DC Network Consolidation',
    workstream: 'Logistics & Freight',
    owner: 'S. Whitfield',
    stage: 'negotiating',
    savings: {
      baseline: 4500000,
      target: 4500000,
      validated: 3000000,
      realized: 0,
    },
    dueDate: '2027-01-31',
    asanaProjectId: 'proj_006',
    lastSyncedAt: '2026-08-10T10:00:00Z',
    createdAt: '2026-01-22T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-007',
    name: 'Co-Packer Rebid (West Region)',
    workstream: 'Packaging & Contract Mfg',
    owner: 'R. Chen',
    stage: 'realized',
    savings: {
      baseline: 650000,
      target: 650000,
      validated: 650000,
      realized: 650000,
    },
    dueDate: '2026-07-01',
    asanaProjectId: 'proj_007',
    lastSyncedAt: '2026-08-09T10:00:00Z',
    createdAt: '2026-01-25T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-008',
    name: 'Corrugate Supplier Consolidation',
    workstream: 'Packaging & Contract Mfg',
    owner: 'R. Chen',
    stage: 'implementing',
    savings: {
      baseline: 900000,
      target: 900000,
      validated: 820000,
      realized: 300000,
    },
    dueDate: '2026-10-01',
    asanaProjectId: 'proj_008',
    lastSyncedAt: '2026-08-12T10:00:00Z',
    createdAt: '2026-02-05T00:00:00Z',
    priorValidated: 750000,
  },
  {
    id: 'init-009',
    name: 'SaaS License Rationalization (Post-Merger Overlap)',
    workstream: 'IT & Telecom',
    owner: 'K. Osei',
    stage: 'implementing',
    savings: {
      baseline: 1800000,
      target: 1800000,
      validated: 1800000,
      realized: 1100000,
    },
    dueDate: '2026-09-15',
    asanaProjectId: 'proj_009',
    lastSyncedAt: '2026-08-13T10:00:00Z',
    createdAt: '2026-01-28T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-010',
    name: 'Telecom/Network Contract Consolidation',
    workstream: 'IT & Telecom',
    owner: 'K. Osei',
    stage: 'validated',
    savings: {
      baseline: 520000,
      target: 520000,
      validated: 480000,
      realized: 0,
    },
    dueDate: '2026-11-30',
    asanaProjectId: 'proj_010',
    lastSyncedAt: '2026-08-08T10:00:00Z',
    createdAt: '2026-02-12T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-011',
    name: 'Facilities Services Rebid (Janitorial/Security)',
    workstream: 'Facilities & Corp Services',
    owner: 'M. Delgado',
    stage: 'negotiating',
    savings: {
      baseline: 610000,
      target: 610000,
      validated: 300000,
      realized: 0,
    },
    dueDate: '2026-08-10',
    asanaProjectId: 'proj_011',
    lastSyncedAt: '2026-08-05T10:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-012',
    name: 'Consulting & Contractor Spend Consolidation',
    workstream: 'Professional Services / SG&A',
    owner: 'M. Delgado',
    stage: 'identified',
    savings: {
      baseline: 1200000,
      target: 1200000,
      validated: 0,
      realized: 0,
    },
    dueDate: '2027-02-01',
    asanaProjectId: 'proj_012',
    lastSyncedAt: '2026-07-23T10:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    priorValidated: null,
  },
  {
    id: 'init-013',
    name: 'Marketing/Agency Spend Rationalization',
    workstream: 'Professional Services / SG&A',
    owner: 'P. Iverson',
    stage: 'validated',
    savings: {
      baseline: 700000,
      target: 700000,
      validated: 700000,
      realized: 0,
    },
    dueDate: '2026-10-31',
    asanaProjectId: 'proj_013',
    lastSyncedAt: '2026-08-13T10:00:00Z',
    createdAt: '2026-03-05T00:00:00Z',
    priorValidated: null,
  },
];

/**
 * 7 workstream summary objects with aggregate savings figures.
 * Values in millions ($M).
 */
export const workstreams = [
  { name: 'Direct Materials', target: 4.3, validated: 3.5, realized: 1.4 },
  { name: 'Indirect / MRO', target: 1.25, validated: 0.85, realized: 0.0 },
  { name: 'Logistics & Freight', target: 6.9, validated: 5.2, realized: 1.9 },
  { name: 'Packaging & Contract Mfg', target: 1.55, validated: 1.47, realized: 0.95 },
  { name: 'IT & Telecom', target: 2.32, validated: 2.28, realized: 1.1 },
  { name: 'Facilities & Corp Services', target: 0.61, validated: 0.30, realized: 0.0 },
  { name: 'Professional Services / SG&A', target: 1.90, validated: 0.70, realized: 0.0 },
];

/**
 * Program metadata matching the demo HTML header values.
 */
export const programMeta = {
  day: 214,
  totalDays: 540,
  fyCommitment: 15000000,
  weekOf: '2026-08-10',
};
