/**
 * ELT export control — real DOM render.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.HTMLElement = dom.window.HTMLElement;

import { renderELTExport } from '../views/elt-export-view.js';

describe('ELT export button', () => {
  const container = document.createElement('div');
  renderELTExport(container, {
    summary: { count: 13, workstreams: 7, totalTarget: 1, totalValidated: 1, totalRealized: 1 },
    signals: [],
    initiatives: [],
  });

  const btn = container.querySelector('.export-btn');

  test('export control is a real button with a 44px-class touch target', () => {
    assert.ok(btn);
    assert.equal(btn.tagName, 'BUTTON');
    assert.equal(btn.type, 'button');
  });

  test('label matches the HTML brief it actually produces, not PPTX', () => {
    assert.equal(btn.textContent, 'Download print-ready brief (HTML)');
    assert.equal(btn.textContent.includes('PPTX'), false);
  });
});
