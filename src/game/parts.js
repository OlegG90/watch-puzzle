// The catalogue of parts, in the order a watchmaker would fit them. Names and
// descriptions live in src/i18n, under each part's id (or a screw's kind).
//
//   kind     parts of the same kind are interchangeable and stack in the tray
//   side     'train' | 'dial' | 'any': which face must be towards the player
//   pos      slot centre (mm); hitR is how far from it a drop still counts
//   hitZ     height of the slot, for projecting the finger onto the movement
//   requires what must already be in place
//   basic    the player fits this in Apprentice; other parts fit themselves
//   screw    fits loose and must then be tightened with the screwdriver
//   tight    refuses to go on while this side has loose screws: 'dial' | 'all'

import { POS } from './layout.js';

const O = [0, 0];

const part = (id, side, pos, hitZ, requires, opts = {}) => ({
  id,
  side,
  pos,
  hitZ,
  requires,
  kind: opts.kind ?? id,
  hitR: opts.hitR ?? 2.5,
  basic: opts.basic ?? false,
  screw: opts.screw ?? false,
  tight: opts.tight ?? null,
});

const screw = (id, kind, side, pos, hitZ, requires) =>
  part(id, side, pos, hitZ, requires, { kind, screw: true, hitR: 1.5 });

export const PARTS = [
  part('mainplate', 'any', O, 0, [], {
    basic: true,
    hitR: 18,
  }),

  // The barrel
  part('drum', 'train', POS.barrel, 2, ['mainplate'], {
    basic: true,
    hitR: 6,
  }),
  part('mainspring', 'train', POS.barrel, 2, ['drum'], {
    hitR: 6,
  }),
  part('arbor', 'train', POS.barrel, 2, ['mainspring']),
  part('barrelCover', 'train', POS.barrel, 3, ['arbor'], {
    hitR: 6,
  }),

  // The going train
  part('fourth', 'train', POS.fourth, 1.1, ['mainplate'], {
    basic: true,
  }),
  part('third', 'train', POS.third, 2.3, ['fourth'], {
    basic: true,
  }),
  part('escape', 'train', POS.escape, 3.4, ['fourth'], {
    basic: true,
    hitR: 2,
  }),
  part('centre', 'train', O, 3.3, ['third', 'barrelCover'], {
    basic: true,
    hitR: 4,
  }),

  part('trainBridge', 'train', [1, -6], 5.8, ['centre', 'third', 'fourth', 'escape'], {
    basic: true,
    hitR: 6,
  }),
  screw('trainScrew1', 'screw-bridge', 'train', POS.trainScrew1, 5.8, ['trainBridge']),
  screw('trainScrew2', 'screw-bridge', 'train', POS.trainScrew2, 5.8, ['trainBridge']),
  screw('trainScrew3', 'screw-bridge', 'train', POS.trainScrew3, 5.8, ['trainBridge']),

  part('barrelBridge', 'train', POS.barrel, 5, ['barrelCover'], {
    basic: true,
    hitR: 6,
  }),
  screw('barrelScrew1', 'screw-bridge', 'train', POS.barrelScrew1, 5, ['barrelBridge']),
  screw('barrelScrew2', 'screw-bridge', 'train', POS.barrelScrew2, 5, ['barrelBridge']),

  // Winding, train side
  part('ratchet', 'train', POS.barrel, 5.6, ['barrelBridge'], {
    basic: true,
    hitR: 4.5,
  }),
  screw('ratchetScrew', 'screw-wheel', 'train', POS.barrel, 6, ['ratchet']),
  part('crownWheel', 'train', POS.crownWheel, 5.6, ['barrelBridge'], {
    hitR: 3,
  }),
  screw('crownWheelScrew', 'screw-wheel', 'train', POS.crownWheel, 6, ['crownWheel']),
  part('click', 'train', POS.click, 5.6, ['ratchet'], {
    hitR: 2,
  }),
  part('clickSpring', 'train', POS.clickSpring, 5.6, ['click'], {
    hitR: 2,
  }),
  screw('clickScrew', 'screw-small', 'train', POS.click, 6, ['clickSpring']),

  // The escapement and the balance
  part('pallet', 'train', POS.pallet, 3.4, ['escape'], {
    basic: true,
    hitR: 2,
  }),
  part('palletBridge', 'train', POS.pallet, 5, ['pallet'], {
    basic: true,
    hitR: 2.5,
  }),
  screw('palletScrew1', 'screw-bridge', 'train', POS.palletScrew1, 5, ['palletBridge']),
  screw('palletScrew2', 'screw-bridge', 'train', POS.palletScrew2, 5, ['palletBridge']),
  part('balance', 'train', POS.balance, 6.5, ['palletBridge', 'trainBridge'], {
    basic: true,
    hitR: 4,
  }),
  part('hairspring', 'train', POS.balance, 7, ['balance'], {
    hitR: 3.5,
  }),
  part('cock', 'train', POS.balance, 8.6, ['hairspring'], {
    basic: true,
    hitR: 3,
  }),
  screw('cockScrew', 'screw-bridge', 'train', POS.cock, 8.6, ['cock']),
  part('regulator', 'train', POS.regulator, 8.8, ['cock'], {
    hitR: 2,
  }),
  part('capJewel', 'train', POS.balance, 8.9, ['cock'], {
    hitR: 1.6,
  }),
  screw('capScrew', 'screw-small', 'train', [POS.balance[0] + 0.9, POS.balance[1] + 1.1], 8.9, ['capJewel']),

  // Keyless works, dial side
  part('windingPinion', 'dial', POS.windingPinion, -3, ['mainplate']),
  part('clutch', 'dial', POS.clutch, -3, ['windingPinion']),
  part('stem', 'dial', [0, 15], -3, ['clutch', 'mainplate'], {
    basic: true,
    hitR: 4,
  }),
  part('lever', 'dial', POS.lever, -3.2, ['stem']),
  part('yoke', 'dial', POS.yoke, -3.2, ['lever']),
  part('keylessPlate', 'dial', POS.keylessPlate, -4, ['yoke'], {
    hitR: 4,
  }),
  screw('keylessScrew1', 'screw-small', 'dial', POS.keylessScrew1, -4, ['keylessPlate']),
  screw('keylessScrew2', 'screw-small', 'dial', POS.keylessScrew2, -4, ['keylessPlate']),

  // Motion works
  part('cannon', 'dial', O, -4.5, ['centre', 'mainplate'], {
    basic: true,
    hitR: 2.5,
  }),
  part('minute', 'dial', POS.minute, -2.6, ['cannon'], {
    basic: true,
    hitR: 3.5,
  }),
  part('minuteBridge', 'dial', POS.minuteBridge, -4, ['minute'], {
    hitR: 3,
  }),
  screw('minuteScrew', 'screw-small', 'dial', POS.minuteScrew, -4, ['minuteBridge']),
  part('hour', 'dial', O, -3.3, ['minute'], {
    basic: true,
    hitR: 3.5,
  }),
  part('setting', 'dial', POS.setting, -2.6, ['minute'], {
    hitR: 2.5,
  }),

  // Dial and hands
  part('dial', 'dial', O, -5.3, [], {
    basic: true,
    hitR: 18,
    tight: 'dial',
  }),
  screw('dialScrew1', 'screw-dial', 'train', POS.dialScrew1, 0, ['dial']),
  screw('dialScrew2', 'screw-dial', 'train', POS.dialScrew2, 0, ['dial']),
  part('hourHand', 'dial', O, -6, ['dial'], {
    basic: true,
    hitR: 4,
  }),
  part('minuteHand', 'dial', O, -6.4, ['hourHand'], {
    basic: true,
    hitR: 4,
  }),
  part('secondsHand', 'dial', POS.fourth, -5.8, ['dial', 'fourth'], {
    basic: true,
    hitR: 2.5,
  }),

  // The case
  part('case', 'any', O, 0, [], {
    basic: true,
    hitR: 19,
    tight: 'all',
  }),
  part('crown', 'any', POS.crown, 0, ['case', 'stem'], {
    basic: true,
    hitR: 5,
  }),
  part('caseBack', 'train', O, 10, ['crown', 'case'], {
    basic: true,
    hitR: 18,
  }),
];

// Covers go on last: each needs everything listed before it that it will hide.
PARTS.forEach((cover, index) => {
  if (!cover.tight) return;
  const hidden = PARTS.slice(0, index).filter((p) => cover.tight === 'all' || p.side === cover.tight);
  cover.requires = hidden.map((p) => p.id);
});

const DIAL_Z = PARTS.find((p) => p.id === 'dial').hitZ;
const idsWhere = (test) => PARTS.filter(test).map((p) => p.id);

/** The reference pictures: what each one shows, and from which face. */
export const REFERENCE_VIEWS = [
  // The bridges hide the wheels, so the wheels get a picture of their own.
  { key: 'refWheels', side: 'train', ids: ['mainplate', 'drum', 'barrelCover', 'fourth', 'third', 'escape', 'centre', 'pallet'] },
  { key: 'refTrainSide', side: 'train', ids: idsWhere((p) => p.id === 'mainplate' || (p.side === 'train' && p.id !== 'caseBack')) },
  { key: 'refUnderDial', side: 'dial', ids: idsWhere((p) => p.id === 'mainplate' || (p.side === 'dial' && p.hitZ > DIAL_Z)) },
  { key: 'refFinished', side: 'dial', ids: idsWhere((p) => p.id !== 'caseBack') },
];

/** Whether this part is fitted from the given face of the movement. */
export const onFace = (part, side) => part.side === 'any' || part.side === side;

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));

export const LEVELS = ['apprentice', 'master', 'expert'];
