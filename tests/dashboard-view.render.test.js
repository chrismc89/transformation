/**
 * Dashboard signal feed — real DOM render.
 * Default view is P1/P2; lower priorities stay behind a reveal toggle.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.HTMLElement = dom.window.HTMLElement;

import { renderDashboard } from '../views/dashboard-view.js';

function fakeStore() {
  return {
    getAll: () => [],
    getSummary: () => ({
      count: 0,
      totalTarget: 0,
      totalValidated: 0,
      totalRealized: 0,
    }),
  };
}

const signals = [
  { priority: 1, title: 'P1 item', consequence: 'c1', action: 'a1' },
  { priority: 3, title: 'P3 item', consequence: 'c3', action: 'a3' },
  { priority: 2, title: 'P2 item', consequence: 'c2', action: 'a2' },
  { priority: 5, title: 'P5 item', consequence: 'c5', action: 'a5' },
];

describe('Dashboard signal feed — default P1/P2 with reveal-more', () => {
  const container = document.createElement('div');
  renderDashboard(container, {
    store: fakeStore(),
    signals,
    workstreams: [],
    initiatives: [],
    summary: fakeStore().getSummary(),
  });

  test('default feed shows only P1 and P2 signals', () => {
    const visible = [...container.querySelectorAll('.signal-feed-primary .signal .title')].map((el) => el.textContent);
    assert.deepEqual(visible, ['P1 item', 'P2 item']);
  });

  test('P3–P5 are present but hidden until the toggle is used', () => {
    const more = container.querySelector('.signal-feed-more');
    assert.ok(more);
    assert.equal(more.hidden, true);
    const titles = [...more.querySelectorAll('.signal .title')].map((el) => el.textContent);
    assert.deepEqual(titles, ['P3 item', 'P5 item']);
  });

  test('toggle reveals then hides lower-priority signals', () => {
    const toggle = container.querySelector('.signal-feed-toggle');
    const more = container.querySelector('.signal-feed-more');
    assert.equal(toggle.tagName, 'BUTTON');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(toggle.textContent.includes('2 lower-priority'));

    toggle.click();
    assert.equal(more.hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(toggle.textContent, 'Show fewer signals');

    toggle.click();
    assert.equal(more.hidden, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  });
});
