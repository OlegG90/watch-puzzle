// Low-level procedural geometry: gears, plates, screws. All sizes are in mm and
// every builder lays its part flat with the z axis as its axle.

import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Extrudes a shape between two heights. */
export function extrude(shape, zFrom, zTo, material, curveSegments = 12) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: zTo - zFrom,
    bevelEnabled: false,
    curveSegments,
  });
  geometry.translate(0, 0, zFrom);
  return new THREE.Mesh(geometry, material);
}

/** A round axle or post, running along z. */
export function post(x, y, zFrom, zTo, radius, material, segments = 16) {
  const geometry = new THREE.CylinderGeometry(radius, radius, zTo - zFrom, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(x, y, (zFrom + zTo) / 2);
  return new THREE.Mesh(geometry, material);
}

/** A flat ring between two radii. */
export function ring(rOuter, rInner, zFrom, zTo, material, segments = 64) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rInner, 0, TAU, true);
  shape.holes.push(hole);
  return extrude(shape, zFrom, zTo, material, segments);
}

export function disc(radius, zFrom, zTo, material, segments = 64) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, TAU, false);
  return extrude(shape, zFrom, zTo, material, segments);
}

/** A closed outline through [x, y] points. */
function polygon(points) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

/** Toothed outline at this pitch radius. A tooth is centred on angle 0. */
function teethOutline(teeth, pitchRadius) {
  const depth = Math.min(pitchRadius * 0.14, (TAU * pitchRadius) / teeth * 0.75);
  const rTip = pitchRadius + depth * 0.5;
  const rRoot = pitchRadius - depth * 0.6;
  const pitch = TAU / teeth;
  const at = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const points = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * pitch;
    points.push(
      at(rRoot, a - pitch * 0.32),
      at(rTip, a - pitch * 0.16),
      at(rTip, a + pitch * 0.16),
      at(rRoot, a + pitch * 0.32),
    );
  }
  return polygon(points);
}

/** Curved windows between spokes, the crossing of a real watch wheel. */
function crossing(shape, spokes, rIn, rOut) {
  const gap = (TAU / spokes) * 0.2;
  for (let i = 0; i < spokes; i += 1) {
    const a0 = (i / spokes) * TAU + gap / 2;
    const a1 = ((i + 1) / spokes) * TAU - gap / 2;
    const hole = new THREE.Path();
    hole.absarc(0, 0, rOut, a0, a1, false);
    hole.absarc(0, 0, rIn, a1, a0, true);
    hole.closePath();
    shape.holes.push(hole);
  }
}

/** A flat wheel. spokes=0 leaves it solid. */
export function gear(teeth, pitchRadius, zFrom, zTo, material, spokes = 4) {
  const shape = teethOutline(teeth, pitchRadius);
  if (spokes > 0) crossing(shape, spokes, pitchRadius * 0.28, pitchRadius * 0.78);
  return extrude(shape, zFrom, zTo, material, 6);
}

/** The sloping, hooked teeth of an escape wheel. */
export function escapeGear(teeth, radius, zFrom, zTo, material) {
  const pitch = TAU / teeth;
  const at = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const points = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * pitch;
    points.push(at(radius * 0.72, a - pitch * 0.72), at(radius, a), at(radius * 0.72, a - pitch * 0.15));
  }
  const shape = polygon(points);
  crossing(shape, 4, radius * 0.22, radius * 0.6);
  return extrude(shape, zFrom, zTo, material, 6);
}

/** A rounded bar from a to b, the building block of every bridge. */
export function capsule(a, b, width, zFrom, zTo, material) {
  const shape = new THREE.Shape();
  const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const r = width / 2;
  shape.absarc(a[0], a[1], r, dir + Math.PI / 2, dir + (3 * Math.PI) / 2, false);
  shape.absarc(b[0], b[1], r, dir - Math.PI / 2, dir + Math.PI / 2, false);
  shape.closePath();
  return extrude(shape, zFrom, zTo, material, 10);
}

/** A ruby set in a gold chaton, seen from above (or below when facing is -1). */
export function jewel(x, y, z, radius, mats, facing = 1) {
  const group = new THREE.Group();
  group.add(post(x, y, z - 0.03 * facing, z + 0.05 * facing, radius * 1.6, mats.gold, 20));
  group.add(post(x, y, z, z + 0.1 * facing, radius, mats.ruby, 16));
  return group;
}

/**
 * A blued screw. Its head rests at zBase and faces along `facing` (+1 train
 * side, -1 dial side). The slot shows how far it has been turned.
 */
export function screw(zBase, radius, mats, facing = 1) {
  const group = new THREE.Group();
  const h = 0.55 * facing;
  group.add(post(0, 0, zBase, zBase + h, radius, mats.blued, 18));
  const slot = new THREE.BoxGeometry(radius * 2.05, radius * 0.32, 0.12);
  slot.translate(0, 0, zBase + h);
  group.add(new THREE.Mesh(slot, mats.dark));
  return group;
}

/** A flat Archimedean spiral ribbon, for the mainspring and hairspring. */
export function spiral(rIn, rOut, turns, width, zFrom, zTo, material) {
  const steps = Math.ceil(turns * 28);
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = t * turns * TAU;
    const r = rIn + (rOut - rIn) * t;
    outer.push([(r + width / 2) * Math.cos(a), (r + width / 2) * Math.sin(a)]);
    inner.push([(r - width / 2) * Math.cos(a), (r - width / 2) * Math.sin(a)]);
  }
  return extrude(polygon([...outer, ...inner.reverse()]), zFrom, zTo, material, 1);
}

/** A solid of revolution about z, from [radius, height] pairs running outward-up. */
export function turned(profile, material, segments = 96) {
  const points = profile.map(([r, z]) => new THREE.Vector2(r, z));
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.rotateX(Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

/** A flat outline through points, with a thin pointed shape for a watch hand. */
export function flatShape(points, zFrom, zTo, material) {
  return extrude(polygon(points), zFrom, zTo, material, 4);
}
