import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trayScale } from '../src/render/trayScale.js';

test('a larger part is always drawn larger', () => {
  for (let mm = 1.4; mm < 56; mm += 0.5) assert.ok(trayScale(mm + 0.5) > trayScale(mm), `${mm} mm`);
});

test('the difference is noticeable but less than the true proportion', () => {
  const shown = trayScale(56) / trayScale(1.4);
  assert.equal(shown, 2);
  assert.ok(shown < 56 / 1.4);
  assert.ok(trayScale(14) / trayScale(5.5) > 1.15, 'a centre wheel beside an escape wheel');
});

test('sizes outside the range stay within the picture and readable', () => {
  assert.equal(trayScale(0.5), 0.5);
  assert.equal(trayScale(100), 1);
});
