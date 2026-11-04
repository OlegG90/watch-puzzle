import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollEdges } from '../src/ui/scrollHint.js';

const scroller = (fields) => ({
  scrollLeft: 0, scrollTop: 0, scrollWidth: 300, clientWidth: 300, scrollHeight: 100, clientHeight: 100, ...fields,
});

test('no hint when everything fits', () => {
  assert.deepEqual(scrollEdges(scroller()), { before: false, after: false });
});

test('a sideways tray hints at the end, both ends, then the start', () => {
  const tray = { scrollWidth: 1000 };
  assert.deepEqual(scrollEdges(scroller(tray)), { before: false, after: true });
  assert.deepEqual(scrollEdges(scroller({ ...tray, scrollLeft: 200 })), { before: true, after: true });
  assert.deepEqual(scrollEdges(scroller({ ...tray, scrollLeft: 700 })), { before: true, after: false });
});

test('an upright tray hints the same way', () => {
  const tray = { scrollHeight: 500 };
  assert.deepEqual(scrollEdges(scroller(tray)), { before: false, after: true });
  assert.deepEqual(scrollEdges(scroller({ ...tray, scrollTop: 150 })), { before: true, after: true });
  assert.deepEqual(scrollEdges(scroller({ ...tray, scrollTop: 400 })), { before: true, after: false });
});

test('only the padding left to scroll counts as the end', () => {
  assert.deepEqual(scrollEdges(scroller({ scrollWidth: 1000, scrollLeft: 695.5 })), { before: true, after: false });
  assert.deepEqual(scrollEdges(scroller({ scrollWidth: 305 })), { before: false, after: false });
});
