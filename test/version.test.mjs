import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/version.js';

test('the version is a plain x.y.z', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('package.json, the offline cache and the changelog carry the same version', () => {
  assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).version, VERSION);
  assert.ok(readFileSync('sw.js', 'utf8').includes(`'watch-puzzle-${VERSION}'`), 'sw.js');
  assert.ok(readFileSync('CHANGELOG.md', 'utf8').includes(`## ${VERSION}`), 'CHANGELOG.md');
});
