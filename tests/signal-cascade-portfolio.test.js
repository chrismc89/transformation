import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPortfolioSignals } from '../core/signal-cascade.js';

const initiatives = [
  { id: 'init-001', name: 'Initiative A', owner: 'Alice', savings: { target: 2000000 } },
  { id: 'init-002', name: 'Initiative B', owner: 'Bob', savings: { target: 3000000 } },
];

test('portfolio evaluators run and produce signals', () => {
  const signals = [];
  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'test-evaluator',
        evaluate(ctx, thr) {
          return [{
            id: 'portfolio-signal',
            initiativeId: null,
            priority: 4,
            title: 'Portfolio alert',
            consequence: 'Something needs attention at portfolio level.',
            action: 'Review portfolio.',
          }];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, signals, bundle, { asOfDate: '2026-08-01' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'portfolio-signal');
  assert.equal(result[0].initiativeId, null);
  assert.equal(result[0].priority, 4);
});

test('portfolio evaluators receive correct context', () => {
  const incomingSignals = [
    { id: 'sig-1', initiativeId: 'init-001', priority: 2, consequence: 'At risk', action: 'Act' },
  ];
  let capturedCtx = null;

  const bundle = {
    thresholds: { myThreshold: 5 },
    evaluators: [
      {
        id: 'ctx-checker',
        evaluate(ctx, thr) {
          capturedCtx = ctx;
          assert.equal(thr.myThreshold, 5);
          return [];
        },
      },
    ],
  };

  runPortfolioSignals(initiatives, incomingSignals, bundle, { asOfDate: '2026-09-01' });
  assert.deepEqual(capturedCtx.initiatives, initiatives);
  assert.deepEqual(capturedCtx.signals, incomingSignals);
  assert.equal(capturedCtx.asOfDate, '2026-09-01');
});

test('try/catch isolation — a throwing evaluator does not break others', () => {
  const signals = [];
  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'throws',
        evaluate() { throw new Error('Intentional failure'); },
      },
      {
        id: 'works',
        evaluate() {
          return [{
            id: 'good-signal',
            initiativeId: null,
            priority: 3,
            title: 'Good signal',
            consequence: 'This should still appear.',
            action: 'Do something.',
          }];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, signals, bundle);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'good-signal');
});

test('dedup Pass 1 — portfolio signals with same id deduplicate, higher priority wins', () => {
  const signals = [];
  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'dup-producer',
        evaluate() {
          return [
            {
              id: 'owner-concentration',
              initiativeId: null,
              priority: 5,
              title: 'Lower priority duplicate',
              consequence: 'Owner X has problems.',
              action: 'Review.',
            },
            {
              id: 'owner-concentration',
              initiativeId: null,
              priority: 3,
              title: 'Higher priority original',
              consequence: 'Owner X has serious problems.',
              action: 'Act now.',
            },
          ];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, signals, bundle);
  // Same id + same initiativeId (null) → only higher priority (3) survives
  const ownerSignals = result.filter(s => s.id === 'owner-concentration');
  assert.equal(ownerSignals.length, 1);
  assert.equal(ownerSignals[0].priority, 3);
  assert.equal(ownerSignals[0].title, 'Higher priority original');
});

test('portfolio signals do not incorrectly dedup against per-initiative signals', () => {
  // Per-initiative signal with same id but different initiativeId
  const incomingSignals = [
    {
      id: 'owner-concentration',
      initiativeId: 'init-001',
      priority: 2,
      title: 'Per-initiative signal',
      consequence: 'Owner X has problems with initiative A.',
      action: 'Fix initiative A.',
    },
  ];

  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'portfolio-eval',
        evaluate() {
          return [{
            id: 'owner-concentration',
            initiativeId: null,
            priority: 4,
            title: 'Portfolio signal',
            consequence: 'Owner X has problems across portfolio.',
            action: 'Review portfolio.',
          }];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, incomingSignals, bundle);
  // Both should survive because initiativeId differs (null vs 'init-001')
  const ownerSignals = result.filter(s => s.id === 'owner-concentration');
  assert.equal(ownerSignals.length, 2);
});

test('portfolio signals with similar consequences dedup against each other via Pass 2', () => {
  const signals = [];
  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'similar-producer',
        evaluate() {
          return [
            {
              id: 'risk-a',
              initiativeId: null,
              priority: 3,
              title: 'Risk A',
              consequence: 'Owner Alice owns too many at risk initiatives in the portfolio.',
              action: 'Rebalance.',
            },
            {
              id: 'risk-b',
              initiativeId: null,
              priority: 4,
              title: 'Risk B',
              consequence: 'Owner Alice owns too many at risk initiatives in the portfolio causing bottleneck.',
              action: 'Rebalance.',
            },
          ];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, signals, bundle);
  // Both have initiativeId: null, so Pass 2 compares them.
  // They're highly similar → lower priority (higher number) gets removed.
  const nullSignals = result.filter(s => s.initiativeId === null);
  assert.equal(nullSignals.length, 1);
  assert.equal(nullSignals[0].priority, 3);
});

test('Pass 2 does not compare portfolio signals against per-initiative signals', () => {
  // A per-initiative signal and a portfolio signal with very similar consequence text
  const incomingSignals = [
    {
      id: 'risk-init',
      initiativeId: 'init-001',
      priority: 2,
      title: 'Initiative risk',
      consequence: 'This initiative has severe capacity risk from the owner.',
      action: 'Fix it.',
    },
  ];

  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'similar-portfolio',
        evaluate() {
          return [{
            id: 'risk-portfolio',
            initiativeId: null,
            priority: 4,
            title: 'Portfolio risk',
            consequence: 'This initiative has severe capacity risk from the owner.',
            action: 'Review.',
          }];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, incomingSignals, bundle);
  // Even though consequence text is identical, they have different initiativeIds
  // (null vs 'init-001'), so Pass 2 won't compare them — both survive.
  assert.equal(result.length, 2);
});

test('output is sorted by priority (ascending)', () => {
  const incomingSignals = [
    { id: 'sig-low', initiativeId: 'init-001', priority: 5, title: 'Low', consequence: 'Low priority.', action: 'Wait.' },
    { id: 'sig-high', initiativeId: 'init-002', priority: 1, title: 'High', consequence: 'High priority.', action: 'Act.' },
  ];

  const bundle = {
    thresholds: {},
    evaluators: [
      {
        id: 'mid-producer',
        evaluate() {
          return [{
            id: 'sig-mid',
            initiativeId: null,
            priority: 3,
            title: 'Mid',
            consequence: 'Mid priority portfolio signal.',
            action: 'Monitor.',
          }];
        },
      },
    ],
  };

  const result = runPortfolioSignals(initiatives, incomingSignals, bundle);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i].priority >= result[i - 1].priority,
      `Expected priority ${result[i].priority} >= ${result[i - 1].priority} at index ${i}`);
  }
  assert.equal(result[0].priority, 1);
  assert.equal(result[result.length - 1].priority, 5);
});

test('returns empty array when no evaluators and no incoming signals', () => {
  const bundle = { thresholds: {}, evaluators: [] };
  const result = runPortfolioSignals([], [], bundle);
  assert.deepEqual(result, []);
});

test('passes through incoming signals unchanged when evaluators produce nothing', () => {
  const incomingSignals = [
    { id: 'existing', initiativeId: 'init-001', priority: 2, title: 'Existing', consequence: 'Exists.', action: 'Act.' },
  ];
  const bundle = {
    thresholds: {},
    evaluators: [{ id: 'empty', evaluate() { return []; } }],
  };

  const result = runPortfolioSignals(initiatives, incomingSignals, bundle);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'existing');
});
