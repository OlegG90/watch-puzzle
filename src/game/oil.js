// The oils and the points they go on, for the Expert level. Names and reasons live
// in src/i18n. Thinner oil goes where a pivot turns faster and carries less load.
//
//   oil      the only kind this point accepts
//   after    the fitted part that makes the point appear
//   before   the later part that would cover it, and is refused until it is oiled
//   side, pos, hitZ, hitR   as for a part, so a fingertip finds it the same way;
//            hitZ is the part's outer face here, so the drop sits on top of it

import { POS } from './layout.js';

export const OILS = ['light', 'medium', 'heavy', 'escapement'];

/** Real oils all look much alike, so the game tells them apart by colour. */
export const OIL_COLORS = {
  light: '#e3f4ff',
  medium: '#3fb950',
  heavy: '#5a2d0c',
  escapement: '#e5396e',
};

const O = [0, 0];

const point = (id, oil, side, pos, hitZ, after, before) => ({
  id, oil, side, pos, hitZ, hitR: 1.5, after, before,
});

export const OIL_POINTS = [
  // The barrel
  point('barrelArborLower', 'heavy', 'train', POS.barrel, 5.3, 'arbor', 'barrelCover'),
  point('barrelArborUpper', 'heavy', 'train', POS.barrel, 5.6, 'barrelBridge', 'ratchet'),

  // Pivots in the bridges, reached through their jewels until the case back closes
  point('centreUpper', 'medium', 'train', O, 5.8, 'trainBridge', 'caseBack'),
  point('thirdUpper', 'medium', 'train', POS.third, 5.8, 'trainBridge', 'caseBack'),
  point('fourthUpper', 'medium', 'train', POS.fourth, 5.8, 'trainBridge', 'caseBack'),
  point('escapeUpper', 'light', 'train', POS.escape, 5.8, 'trainBridge', 'caseBack'),

  // The escapement and the balance
  point('palletStones', 'escapement', 'train', POS.pallet, 3.4, 'pallet', 'palletBridge'),
  point('palletUpper', 'light', 'train', POS.pallet, 5, 'palletBridge', 'caseBack'),
  point('balanceUpper', 'light', 'train', POS.balance, 8.6, 'cock', 'capJewel'),

  // Pivots in the mainplate, reached from the dial side until the dial goes on
  point('centreLower', 'medium', 'dial', O, -2, 'centre', 'cannon'),
  point('thirdLower', 'medium', 'dial', POS.third, -2, 'third', 'dial'),
  point('fourthLower', 'medium', 'dial', POS.fourth, -2, 'fourth', 'dial'),
  point('escapeLower', 'light', 'dial', POS.escape, -2, 'escape', 'dial'),
  point('palletLower', 'light', 'dial', POS.pallet, -2, 'pallet', 'dial'),
  point('balanceLower', 'light', 'dial', POS.balance, -2, 'balance', 'dial'),

  // The motion works
  point('cannon', 'medium', 'dial', O, -6.5, 'cannon', 'hour'),
  point('minute', 'medium', 'dial', POS.minute, -3.9, 'minute', 'minuteBridge'),
  point('hour', 'medium', 'dial', O, -6.1, 'hour', 'dial'),
  point('setting', 'medium', 'dial', POS.setting, -3.1, 'setting', 'dial'),
];

export const OIL_POINT_BY_ID = Object.fromEntries(OIL_POINTS.map((p) => [p.id, p]));
