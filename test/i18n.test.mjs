import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OILS, OIL_POINTS } from '../src/game/oil.js';
import { LEVELS, PARTS } from '../src/game/parts.js';
import {
  DEFAULT_LANGUAGE, LANGUAGES, getLanguage, oilDesc, oilName, oilPointName, oilWhy, partDesc, partName, setLanguage, t,
} from '../src/i18n/index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLanguage(DEFAULT_LANGUAGE));

test('English is the default, and unknown saved values fall back to it', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(getLanguage(), 'en');
  for (const bad of [null, undefined, 'fr', 42, '__proto__', 'constructor', ['uk']]) {
    setLanguage('uk');
    setLanguage(bad);
    assert.equal(getLanguage(), 'en', String(bad));
  }
});

for (const code of Object.keys(LANGUAGES)) {
  test(`${code}: every part, screw, level and grade has text`, () => {
    setLanguage(code);
    for (const part of PARTS) {
      assert.ok(partName(part), `${part.id} name`);
      assert.ok(partDesc(part), `${part.id} desc`);
    }
    const { levels, grades } = LANGUAGES[code].dictionary;
    for (const level of LEVELS) assert.ok(levels[level].name && levels[level].note, level);
    for (const stars of [1, 2, 3]) assert.ok(grades[stars], `grade ${stars}`);
  });

  test(`${code}: every oil and oil point has text`, () => {
    setLanguage(code);
    for (const oil of OILS) assert.ok(oilName(oil) && oilDesc(oil) && oilWhy(oil), oil);
    for (const point of OIL_POINTS) assert.ok(oilPointName(point), point.id);
    assert.equal(Object.keys(LANGUAGES[code].dictionary.oilPoints).length, OIL_POINTS.length);
  });
}

test('both languages have the same interface keys and placeholders', () => {
  const en = LANGUAGES.en.dictionary.ui;
  const uk = LANGUAGES.uk.dictionary.ui;
  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.deepEqual(placeholders(uk[key]), placeholders(en[key]), key);
  }
});

test('the dictionaries hold no text for parts that do not exist', () => {
  const ids = new Set(PARTS.filter((p) => !p.screw).map((p) => p.id));
  const kinds = new Set(PARTS.filter((p) => p.screw).map((p) => p.kind));
  for (const { dictionary } of Object.values(LANGUAGES)) {
    for (const id of Object.keys(dictionary.parts)) assert.ok(ids.has(id), id);
    for (const kind of Object.keys(dictionary.screws)) assert.ok(kinds.has(kind), kind);
  }
});

test('placeholders are filled in', () => {
  assert.equal(t('hintPlace', { name: 'Dial' }), 'Dial goes here.');
  setLanguage('uk');
  assert.equal(t('hintPlace', { name: 'Циферблат' }), 'Деталь «Циферблат» стає сюди.');
});

test('every key the page and the game use exists', () => {
  const ui = LANGUAGES.en.dictionary.ui;
  const html = readFileSync('index.html', 'utf8');
  for (const [, key] of html.matchAll(/data-i18n(?:-label)?="(\w+)"/g)) assert.ok(ui[key], key);
  const main = readFileSync('src/main.js', 'utf8');
  for (const [, key] of main.matchAll(/\bt\('(\w+)'/g)) assert.ok(ui[key], key);
});

test('no Ukrainian is left outside the language files', () => {
  const cyrillic = /[Ѐ-ӿ]/;
  for (const file of ['index.html', 'manifest.webmanifest', 'src/main.js', 'src/game/parts.js', 'src/game/state.js']) {
    assert.ok(!cyrillic.test(readFileSync(file, 'utf8')), file);
  }
});

test('the offline cache lists every source file', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name).replaceAll('\\', '/')]
  ));
  for (const file of walk('src')) assert.ok(sw.includes(`'${file}'`), file);
});
