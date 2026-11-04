// The kinematics of the running watch: every angle follows from one number, the
// seconds since 12:00, through the real tooth counts. Angles are radians about
// +z, which reads as clockwise when you look at the dial from the -z side.

import { GEARS, MESHES } from './layout.js';

const TAU = Math.PI * 2;
const BEATS_PER_SECOND = 5; // 18 000 vibrations per hour
const BALANCE_HZ = 2.5;
const BALANCE_AMPLITUDE = 3.6; // rad, roughly 200 degrees either way
const PALLET_THROW = 0.12;

const ratio = (driver, driven) => GEARS[driver].teeth / GEARS[driven].teeth;

// Revolutions of each arbor per revolution of the centre wheel. The sign is the
// direction: each mesh reverses it.
export const CENTRE_RATIOS = {
  centre: 1,
  cannon: 1,
  barrel: -ratio('centrePinion', 'barrel'),
  third: -ratio('centre', 'thirdPinion'),
  fourth: ratio('centre', 'thirdPinion') * ratio('third', 'fourthPinion'),
  escape: -ratio('centre', 'thirdPinion') * ratio('third', 'fourthPinion') * ratio('fourth', 'escapePinion'),
  minute: -ratio('cannon', 'minute'),
  hour: ratio('cannon', 'minute') * ratio('minutePinion', 'hour'),
};

/**
 * The angle that makes a driven gear's gap meet the driver's tooth at the mesh
 * line. The result is the driven arbor's angle when the driver is at driverAngle.
 */
export function meshPhase(driverTeeth, drivenTeeth, driverPos, drivenPos, driverAngle) {
  const dir = Math.atan2(drivenPos[1] - driverPos[1], drivenPos[0] - driverPos[0]);
  const driverFraction = ((dir - driverAngle) * driverTeeth) / TAU;
  const drivenFraction = 0.5 - driverFraction;
  return dir + Math.PI - (drivenFraction * TAU) / drivenTeeth;
}

/** A fixed phase per arbor, chosen once so all meshes engage for the whole run. */
export const PHASES = (() => {
  const phases = { barrel: 0 };
  const chain = [
    ['barrel', 'centre', 0],
    ['centre', 'third', 1],
    ['third', 'fourth', 2],
    ['fourth', 'escape', 3],
  ];
  for (const [driver, driven, meshIndex] of chain) {
    const [a, b, posA, posB] = MESHES[meshIndex];
    phases[driven] = meshPhase(GEARS[a].teeth, GEARS[b].teeth, posA, posB, phases[driver]);
  }
  phases.cannon = 0;
  const [, , cannonPos, minutePos] = MESHES[4];
  phases.minute = meshPhase(GEARS.cannon.teeth, GEARS.minute.teeth, cannonPos, minutePos, 0);
  const [, , minutePos2, hourPos] = MESHES[5];
  phases.hour = meshPhase(GEARS.minutePinion.teeth, GEARS.hour.teeth, minutePos2, hourPos, phases.minute);
  return phases;
})();

/** Seconds since 12:00 on the watch's own twelve-hour dial. */
export function dialSeconds(date) {
  return (date.getHours() % 12) * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
}

/**
 * All moving angles at a moment.
 * @param {number} seconds seconds since 12:00
 * @param {boolean} running a stopped watch rests: balance centred, no beat
 */
export function trainAngles(seconds, running = true) {
  // The train only moves when the escapement releases it, hence the steps.
  const stepped = running ? Math.floor(seconds * BEATS_PER_SECOND) / BEATS_PER_SECOND : seconds;
  const centreTurn = (stepped / 3600) * TAU;
  const angles = {};
  for (const [arbor, r] of Object.entries(CENTRE_RATIOS)) {
    angles[arbor] = (PHASES[arbor] ?? 0) + r * centreTurn;
  }
  const hourTurn = (stepped / 43200) * TAU;
  angles.hourHand = hourTurn;
  angles.minuteHand = centreTurn;
  angles.secondsHand = ((stepped % 60) / 60) * TAU;
  const swing = Math.sin(seconds * BALANCE_HZ * TAU);
  angles.balance = running ? BALANCE_AMPLITUDE * swing : 0;
  angles.pallet = running ? PALLET_THROW * Math.sign(swing) : 0;
  return angles;
}
