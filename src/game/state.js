// The rules of the game, free of any rendering, so they can be tested directly.

import { PARTS, PART_BY_ID } from './parts.js';

export const TOOLS = { TWEEZERS: 'tweezers', SCREWDRIVER: 'screwdriver' };

export class Game {
  /** @param {'apprentice'|'master'} level */
  constructor(level, saved = null) {
    this.level = level;
    this.installed = new Set(saved?.installed ?? []);
    this.tightened = new Set(saved?.tightened ?? []);
    this.mistakes = saved?.mistakes ?? 0;
    this.hints = saved?.hints ?? 0;
    this.elapsedMs = saved?.elapsedMs ?? 0;
    this.wound = saved?.wound ?? false;
    this.seed = saved?.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.tool = TOOLS.TWEEZERS;
    // Only the master fits the small parts by hand.
    this.playable = level === 'master' ? PARTS : PARTS.filter((p) => p.basic);
  }

  toJSON() {
    return {
      level: this.level,
      installed: [...this.installed],
      tightened: [...this.tightened],
      mistakes: this.mistakes,
      hints: this.hints,
      elapsedMs: this.elapsedMs,
      wound: this.wound,
      seed: this.seed,
    };
  }

  isInstalled(id) {
    return this.installed.has(id);
  }

  isPlayable(part) {
    return this.level === 'master' || part.basic;
  }

  get total() {
    return this.playable.length;
  }

  get placed() {
    return this.playable.filter((p) => this.installed.has(p.id)).length;
  }

  get assembled() {
    return PARTS.every((p) => this.installed.has(p.id)) && this.looseScrews().length === 0;
  }

  /** Unfitted parts grouped by kind, for the tray. */
  trayStacks() {
    const stacks = new Map();
    for (const p of this.playable) {
      if (this.installed.has(p.id)) continue;
      if (!stacks.has(p.kind)) stacks.set(p.kind, { kind: p.kind, part: p, count: 0 });
      stacks.get(p.kind).count += 1;
    }
    const list = [...stacks.values()];
    // The catalogue is in fitting order, so the master's tray must not give it away.
    if (this.level === 'master') {
      list.sort((a, b) => scatter(a.kind, this.seed) - scatter(b.kind, this.seed));
    }
    return list;
  }

  /** Unfitted slots a part of this kind could go in, ready or not. */
  openSlots(kind) {
    return this.playable.filter((p) => p.kind === kind && !this.installed.has(p.id));
  }

  missingFor(part) {
    return part.requires.filter((id) => !this.installed.has(id)).map((id) => PART_BY_ID[id]);
  }

  looseScrews(side = null) {
    return PARTS.filter(
      (p) => p.screw && this.installed.has(p.id) && !this.tightened.has(p.id) && (!side || p.side === side),
    );
  }

  /**
   * Fit the part in this slot.
   * @returns {{ok: true, auto: object[]} | {ok: false, reason: 'blocked'|'loose', missing?: object[], loose?: object[]}}
   */
  place(slotId) {
    const part = PART_BY_ID[slotId];
    const missing = this.missingFor(part);
    if (missing.length) {
      this.mistakes += 1;
      return { ok: false, reason: 'blocked', missing: this.#playableBlockers(part) };
    }
    if (part.tight) {
      const loose = this.looseScrews(part.tight === 'all' ? null : part.tight);
      if (loose.length) {
        this.mistakes += 1;
        return { ok: false, reason: 'loose', loose };
      }
    }
    this.installed.add(part.id);
    return { ok: true, auto: this.#fitSmallParts() };
  }

  /** Fitted parts the player can actually see, so a tap never reaches through a cover. */
  visibleParts() {
    const dialOn = this.installed.has('dial');
    const backOn = this.installed.has('caseBack');
    return PARTS.filter((p) => {
      if (!this.installed.has(p.id)) return false;
      if (dialOn && p.side === 'dial' && p.hitZ > PART_BY_ID.dial.hitZ) return false;
      if (backOn && p.side === 'train' && p.id !== 'caseBack') return false;
      return true;
    });
  }

  /** Records a drop that did not land near any slot of the part. */
  miss() {
    this.mistakes += 1;
  }

  tighten(id) {
    const part = PART_BY_ID[id];
    if (!part?.screw || !this.installed.has(id) || this.tightened.has(id)) return false;
    this.tightened.add(id);
    return true;
  }

  /** The part to do next, for a hint: the selected kind's slot if it is ready. */
  suggest(selectedKind = null) {
    if (selectedKind) {
      const slot = this.openSlots(selectedKind).find((p) => this.canFit(p));
      if (slot) return { type: 'place', part: slot };
    }
    const loose = this.looseScrews();
    const blocker = this.playable.find((p) => !this.installed.has(p.id) && p.tight);
    const next = this.playable.find((p) => !this.installed.has(p.id) && this.canFit(p));
    if (loose.length && (!next || next === blocker)) return { type: 'tighten', part: loose[0] };
    if (next) return { type: 'place', part: next };
    if (loose.length) return { type: 'tighten', part: loose[0] };
    return null;
  }

  /** What the player must fit first: small parts that fit themselves are traced through. */
  #playableBlockers(part) {
    const blockers = new Set();
    const visit = (p) => {
      for (const m of this.missingFor(p)) {
        if (this.isPlayable(m)) blockers.add(m);
        else visit(m);
      }
    };
    visit(part);
    return [...blockers];
  }

  canFit(part) {
    if (this.missingFor(part).length) return false;
    if (!part.tight) return true;
    return this.looseScrews(part.tight === 'all' ? null : part.tight).length === 0;
  }

  /** In Apprentice, anything not played by hand drops in once it is able to. */
  #fitSmallParts() {
    const fitted = [];
    if (this.level === 'master') return fitted;
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of PARTS) {
        if (p.basic || this.installed.has(p.id) || this.missingFor(p).length) continue;
        this.installed.add(p.id);
        if (p.screw) this.tightened.add(p.id);
        fitted.push(p);
        changed = true;
      }
    }
    return fitted;
  }
}

/** A stable pseudo-random rank: the same layout after a reload, a new one each game. */
function scatter(text, seed) {
  let h = seed;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x5bd1e995);
  return (h ^ (h >>> 13)) >>> 0;
}

/** The grade is the point of replaying: mistakes and hints cost, time does not. */
export function grade(game) {
  const cost = game.mistakes + game.hints * 2;
  if (cost === 0) return { stars: 3, label: 'Майстерна робота' };
  if (cost <= game.total / 5) return { stars: 2, label: 'Упевнена рука' };
  return { stars: 1, label: 'Годинник іде' };
}
