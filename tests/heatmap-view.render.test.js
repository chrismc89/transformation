/**
 * Heatmap — real DOM render for RAG labels and mobile card data-labels.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.HTMLElement = dom.window.HTMLElement;

import { renderHeatmap } from '../views/heatmap-view.js';
import { workstreams, initiatives } from '../data/demo-fixtures.js';

describe('Heatmap table — RAG labels and card markup', () => {
  const container = document.createElement('div');
  renderHeatmap(container, {
    workstreams,
    signals: [],
    initiatives,
  });

  test('every RAG cell includes a text label beside the dot', () => {
    const cells = container.querySelectorAll('td[data-label="RAG"]');
    assert.equal(cells.length, workstreams.length);
    for (const cell of cells) {
      assert.ok(cell.querySelector('.rag-dot'));
      assert.ok(cell.textContent.includes('On Track'));
    }
  });

  test('heatmap cells have data-label attributes for the mobile card layout', () => {
    const firstRow = container.querySelector('tbody tr');
    const labels = [...firstRow.querySelectorAll('td')].map((td) => td.getAttribute('data-label'));
    assert.deepEqual(labels, [
      'Workstream', 'Initiatives', 'Target', 'Validated', 'Realized', '% to Target', 'RAG',
    ]);
    assert.ok(firstRow.querySelector('td[data-primary]'));
  });
});
