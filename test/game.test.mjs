import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEARS, MESHES } from '../src/game/layout.js';
import { PARTS, PART_BY_ID } from '../src/game/parts.js';
import { Game, grade } from '../src/game/state.js';
import { CENTRE_RATIOS, dialSeconds, meshPhase, trainAngles } from '../src/game/train.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Picks parts at random among those ready: a player in an arbitrary order. */
function playToEnd(game, random) {
  for (let guard = 0; guard < 1000 && !game.assembled; guard += 1) {
    const stacks = game.trayStacks();
    const loose = game.looseScrews();
    const ready = stacks
      .flatMap((s) => game.openSlots(s.kind))
      .filter((p) => !game.missingFor(p).length && !(p.tight && loose.length));
    if (loose.length && (random() < 0.5 || !ready.length)) {
      game.tighten(loose[0].id);
    } else {
      assert.ok(ready.length, `dead end with ${game.placed}/${game.total} placed`);
      const result = game.place(ready[Math.floor(random() * ready.length)].id);
      assert.equal(result.ok, true);
    }
  }
  assert.equal(game.assembled, true);
}

const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test('every requirement refers to a real part fitted earlier in the list', () => {
  const seen = new Set();
  for (const p of PARTS) {
    for (const r of p.requires) {
      assert.ok(PART_BY_ID[r], `${p.id} requires unknown ${r}`);
      assert.ok(seen.has(r), `${p.id} requires ${r}, which is listed after it`);
    }
    seen.add(p.id);
  }
});

test('part ids are unique', () => {
  assert.equal(new Set(PARTS.map((p) => p.id)).size, PARTS.length);
});

test('every part sits inside the case, except the crown', () => {
  for (const p of PARTS) {
    if (p.id !== 'crown') assert.ok(Math.hypot(...p.pos) < 20, `${p.id} is outside the movement`);
  }
});

for (const level of ['apprentice', 'master']) {
  test(`${level}: any legal order reaches the end with no dead ends`, () => {
    for (let seed = 1; seed <= 200; seed += 1) playToEnd(new Game(level), seeded(seed));
  });

  test(`${level}: following suggest() alone finishes the watch`, () => {
    const game = new Game(level);
    for (let guard = 0; guard < 1000 && !game.assembled; guard += 1) {
      const s = game.suggest();
      assert.ok(s, 'no suggestion before the end');
      if (s.type === 'tighten') assert.equal(game.tighten(s.part.id), true);
      else assert.equal(game.place(s.part.id).ok, true);
    }
    assert.equal(game.assembled, true);
    assert.equal(game.mistakes, 0);
  });
}

test('apprentice plays fewer parts than master and fits the rest itself', () => {
  const a = new Game('apprentice');
  const m = new Game('master');
  assert.ok(a.total < m.total);
  a.place('mainplate');
  const r = a.place('drum');
  assert.deepEqual(r.auto.map((p) => p.id), ['mainspring', 'arbor', 'barrelCover']);
  assert.equal(m.place('mainplate').auto.length, 0);
});

test('fitting out of order is refused, names the blocker, and counts a mistake', () => {
  const g = new Game('master');
  const r = g.place('drum');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'blocked');
  assert.deepEqual(r.missing.map((p) => p.id), ['mainplate']);
  assert.equal(g.mistakes, 1);
  assert.equal(g.isInstalled('drum'), false);
});

test('the dial refuses to cover loose screws on its side only', () => {
  const g = new Game('master');
  const order = PARTS.slice(0, PARTS.findIndex((p) => p.id === 'dial'));
  for (const p of order) assert.equal(g.place(p.id).ok, true, p.id);
  const r = g.place('dial');
  assert.equal(r.reason, 'loose');
  assert.ok(r.loose.every((p) => p.side === 'dial'));
  for (const p of r.loose) g.tighten(p.id);
  assert.equal(g.place('dial').ok, true);
});

test('no cover goes on while anything beneath it is missing', () => {
  const g = new Game('master');
  g.place('mainplate');
  assert.equal(g.place('case').reason, 'blocked');
  assert.equal(g.place('dial').reason, 'blocked');
  const dialIndex = PARTS.findIndex((p) => p.id === 'dial');
  for (const p of PARTS.slice(0, dialIndex).filter((x) => x.side === 'dial')) {
    assert.ok(PART_BY_ID.dial.requires.includes(p.id), p.id);
  }
  const caseIndex = PARTS.findIndex((p) => p.id === 'case');
  for (const p of PARTS.slice(0, caseIndex)) {
    assert.ok(PART_BY_ID.case.requires.includes(p.id), p.id);
  }
});

test('a tap cannot reach parts hidden under the dial or the case back', () => {
  const g = new Game('apprentice');
  for (let s = g.suggest(); s && s.part.id !== 'hourHand'; s = g.suggest()) {
    if (s.type === 'tighten') g.tighten(s.part.id);
    else g.place(s.part.id);
  }
  const visible = () => g.visibleParts().map((p) => p.id);
  assert.ok(g.isInstalled('dial'));
  assert.ok(!visible().includes('hour'));
  assert.ok(!visible().includes('cannon'));
  assert.ok(visible().includes('dial'));
  assert.ok(visible().includes('trainBridge'));
  for (let s = g.suggest(); s; s = g.suggest()) {
    if (s.type === 'tighten') g.tighten(s.part.id);
    else g.place(s.part.id);
  }
  assert.ok(!visible().includes('trainBridge'));
  assert.ok(visible().includes('caseBack'));
  assert.ok(visible().includes('minuteHand'));
});

test('tighten only works once, on a fitted screw', () => {
  const g = new Game('master');
  assert.equal(g.tighten('trainScrew1'), false);
  assert.equal(g.tighten('mainplate'), false);
  for (const p of PARTS.slice(0, PARTS.findIndex((x) => x.id === 'trainScrew1') + 1)) g.place(p.id);
  assert.equal(g.tighten('trainScrew1'), true);
  assert.equal(g.tighten('trainScrew1'), false);
});

test('screws of a kind stack together in the tray', () => {
  const stack = new Game('master').trayStacks().find((s) => s.kind === 'screw-bridge');
  assert.equal(stack.count, 8);
});

test('progress survives a save and reload', () => {
  const g = new Game('master');
  g.place('mainplate');
  g.place('drum');
  g.miss();
  const back = new Game('master', JSON.parse(JSON.stringify(g)));
  assert.equal(back.placed, 2);
  assert.equal(back.mistakes, 1);
  assert.equal(back.isInstalled('drum'), true);
});

test('grade rewards a clean run', () => {
  const g = new Game('apprentice');
  assert.equal(grade(g), 3);
  g.mistakes = 2;
  assert.equal(grade(g), 2);
  g.mistakes = 50;
  assert.equal(grade(g), 1);
});

test('meshing arbors sit exactly at the sum of their pitch radii', () => {
  for (const [a, b, pa, pb] of MESHES) {
    assert.ok(Math.abs(dist(pa, pb) - (GEARS[a].r + GEARS[b].r)) < 1e-9, `${a}/${b}`);
  }
});

test('the train gives true watch speeds', () => {
  assert.equal(CENTRE_RATIOS.fourth, 60); // the seconds wheel: once a minute
  assert.ok(Math.abs(CENTRE_RATIOS.hour - 1 / 12) < 1e-12); // the hour wheel: once in 12 h
  assert.equal(-CENTRE_RATIOS.escape, 600);
  assert.equal(-CENTRE_RATIOS.third, 8);
  assert.equal(-CENTRE_RATIOS.barrel, 1 / 8);
});

test('hands read the time on the clock', () => {
  const at = (h, m, s) => trainAngles(dialSeconds(new Date(2026, 0, 1, h, m, s)));
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(at(12, 0, 0).hourHand, 0);
  near(at(3, 0, 0).hourHand, TAU / 4);
  near(at(15, 0, 0).hourHand, TAU / 4);
  near(at(6, 30, 0).minuteHand, TAU * 6.5);
  near(at(1, 2, 15).secondsHand, TAU / 4);
});

test('teeth stay engaged at every mesh as the train turns', () => {
  const pairs = [['barrel', 'centre', 0], ['centre', 'third', 1], ['third', 'fourth', 2], ['fourth', 'escape', 3]];
  for (const secs of [0, 1, 17.4, 3600.2, 40000]) {
    const a = trainAngles(secs);
    for (const [driver, driven, i] of pairs) {
      const [ga, gb, pa, pb] = MESHES[i];
      const expected = meshPhase(GEARS[ga].teeth, GEARS[gb].teeth, pa, pb, a[driver]);
      const pitch = TAU / GEARS[gb].teeth;
      const off = ((a[driven] - expected) % pitch + pitch) % pitch;
      assert.ok(Math.min(off, pitch - off) < 1e-6, `${driver}/${driven} at ${secs}s: ${off}`);
    }
  }
});

test('the balance rests at twelve o\'clock, where assembly happens, and swings once running', () => {
  assert.equal(trainAngles(0).balance, 0);
  assert.equal(trainAngles(0).pallet, 0);
  assert.notEqual(trainAngles(10.1).balance, 0);
});
