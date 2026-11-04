// How large a part's picture is drawn on its tray card. True proportions would span
// 40 to 1 and leave the screws unrecognisable, so the size is compressed to 2 to 1.

const SMALLEST_MM = 1.4; // the small screws
const LARGEST_MM = 56; // the case
const SMALLEST_SCALE = 0.5;

/** @param {number} mm the part's largest extent @returns {number} share of the picture it fills */
export function trayScale(mm) {
  const position = Math.log(mm / SMALLEST_MM) / Math.log(LARGEST_MM / SMALLEST_MM);
  const clamped = Math.min(1, Math.max(0, position));
  return SMALLEST_SCALE + (1 - SMALLEST_SCALE) * clamped;
}
