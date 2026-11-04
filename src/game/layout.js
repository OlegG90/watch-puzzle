// Geometry of the movement, in millimetres. +y is 12 o'clock, +z points at the
// train side (the bridges); the dial side is at -z. Every meshing pair sits at
// exactly the sum of its pitch radii, so the gears really do engage.

const polar = ([x, y], dist, deg) => {
  const a = (deg * Math.PI) / 180;
  return [x + dist * Math.cos(a), y + dist * Math.sin(a)];
};

/** The intersection of two circles lying to the right of the line a→b. */
function circleIntersection(a, ra, b, rb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(ra * ra - along * along);
  return [a[0] + (along * dx + h * dy) / d, a[1] + (along * dy - h * dx) / d];
}

/** teeth: tooth count. r: pitch radius. */
export const GEARS = {
  barrel: { teeth: 80, r: 8.5 },
  centrePinion: { teeth: 10, r: 1.0625 },
  centre: { teeth: 80, r: 6.8 },
  thirdPinion: { teeth: 10, r: 0.85 },
  third: { teeth: 75, r: 5.625 },
  fourthPinion: { teeth: 10, r: 0.75 },
  fourth: { teeth: 80, r: 4.4 },
  escapePinion: { teeth: 8, r: 0.44 },
  escape: { teeth: 15, r: 2.8 },
  cannon: { teeth: 12, r: 1.5 },
  minute: { teeth: 36, r: 4.5 },
  minutePinion: { teeth: 10, r: 1.2 },
  hour: { teeth: 40, r: 4.8 },
};

const meshDistance = (a, b) => GEARS[a].r + GEARS[b].r;

const CENTRE = [0, 0];
const FOURTH = [0, -11];
const BARREL = polar(CENTRE, meshDistance('barrel', 'centrePinion'), 130);
const THIRD = circleIntersection(
  CENTRE,
  meshDistance('centre', 'thirdPinion'),
  FOURTH,
  meshDistance('third', 'fourthPinion'),
);
const ESCAPE = polar(FOURTH, meshDistance('fourth', 'escapePinion'), -25);
const MINUTE = polar(CENTRE, meshDistance('cannon', 'minute'), 215);

export const POS = {
  centre: CENTRE,
  fourth: FOURTH,
  barrel: BARREL,
  third: THIRD,
  escape: ESCAPE,
  minute: MINUTE,
  pallet: polar(ESCAPE, 4, 5),
  balance: [11.2, -7.6],
  crownWheel: [0, 13.33],
  click: polar(BARREL, 6.5, 203),
  clickSpring: polar(BARREL, 7, 222),
  setting: polar(MINUTE, 6.1, 140),
  cock: [15.6, -11.2],
  regulator: [13.4, -9.4],
  windingPinion: [0, 16.5],
  clutch: [0, 12.5],
  lever: [3.5, 9],
  yoke: [-3.5, 11],
  keylessPlate: [0, 14],
  minuteBridge: polar(MINUTE, 2.6, 225),
  crown: [0, 24],
  // Screws
  trainScrew1: [8.8, -0.5],
  trainScrew2: [-4.6, -13.2],
  trainScrew3: [-6.2, -5.5],
  barrelScrew1: [-14.8, 3.6],
  barrelScrew2: [-8.6, 16],
  palletScrew1: [11.8, -14.6],
  palletScrew2: [5.5, -16.6],
  keylessScrew1: [5.5, 14],
  keylessScrew2: [-5.5, 15],
  minuteScrew: [-8.5, -8.5],
  dialScrew1: [17.5, 8],
  dialScrew2: [-17, -8],
};

/** Pairs that mesh: [gear on axis A, gear on axis B, axis A position, axis B position]. */
export const MESHES = [
  ['barrel', 'centrePinion', POS.barrel, POS.centre],
  ['centre', 'thirdPinion', POS.centre, POS.third],
  ['third', 'fourthPinion', POS.third, POS.fourth],
  ['fourth', 'escapePinion', POS.fourth, POS.escape],
  ['cannon', 'minute', POS.centre, POS.minute],
  ['minutePinion', 'hour', POS.minute, POS.centre],
];
