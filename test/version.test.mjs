import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/version.js';

test('the release workflow publishes every file the game needs', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const serve = readFileSync('scripts/serve.mjs', 'utf8');
  const files = serve.match(/const PUBLIC = \[(.*?)\]/)[1].match(/'[^']+'/g).map((f) => f.slice(1, -1));
  const copied = workflow.match(/cp -r (.*) _site/)[1].split(' ');
  assert.deepEqual([...copied].sort(), [...files].sort());
});

test('the version is a plain x.y.z', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('package.json, the offline cache and the changelog carry the same version', () => {
  assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).version, VERSION);
  assert.ok(readFileSync('sw.js', 'utf8').includes(`'watch-puzzle-${VERSION}'`), 'sw.js');
  assert.ok(readFileSync('CHANGELOG.md', 'utf8').includes(`## ${VERSION}`), 'CHANGELOG.md');
});
