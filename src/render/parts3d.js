// One builder per part. Each returns a Group whose origin is the part's slot
// (its `pos` in the catalogue), so the same object serves the movement, the
// dragged copy, the hint ghost and the tray thumbnail. Heights stay absolute.

import * as THREE from 'three';
import { GEARS, POS } from '../game/layout.js';
import { PART_BY_ID } from '../game/parts.js';
import { createDialTexture } from './materials.js';
import {
  capsule, disc, escapeGear, flatShape, gear, jewel, post, ring, screw, spiral, turned,
} from './shapes.js';

const group = (...children) => {
  const g = new THREE.Group();
  g.add(...children);
  return g;
};

/** Makes absolute mm coordinates relative to the part's own slot. */
const rel = (p, origin) => [p[0] - origin[0], p[1] - origin[1]];

const JEWEL_R = 0.42;

/** A wheel with its pinion below or above and an axle running between pivots. */
function wheel(mats, { wheelZ, wheelGear, pinionGear, pinionZ, axle, spokes = 4 }) {
  return group(
    gear(GEARS[wheelGear].teeth, GEARS[wheelGear].r, wheelZ, wheelZ + 0.28, mats.wheel, spokes),
    post(0, 0, axle[0], axle[1], 0.28, mats.steel, 12),
    post(0, 0, wheelZ - 0.05, wheelZ + 0.34, GEARS[wheelGear].r * 0.16, mats.brass, 16),
    gear(GEARS[pinionGear].teeth, GEARS[pinionGear].r, pinionZ[0], pinionZ[1], mats.steel, 0),
  );
}

/** A bridge: rounded arms in plan, with posts standing it on the plate. */
function bridge(mats, origin, arms, { z, posts = [], zFloor = 0 }) {
  const g = new THREE.Group();
  for (const [a, b, width] of arms) {
    g.add(capsule(rel(a, origin), rel(b, origin), width, z[0], z[1], mats.bridge));
  }
  // Posts run from the bridge down to the plate, on whichever side it sits.
  const [postFrom, postTo] = z[0] >= zFloor ? [zFloor, z[0]] : [z[1], zFloor];
  for (const p of posts) {
    const [x, y] = rel(p, origin);
    g.add(post(x, y, postFrom, postTo, 1.1, mats.brass, 14));
  }
  return g;
}

const SCREW_R = { 'screw-bridge': 0.95, 'screw-wheel': 1.2, 'screw-small': 0.65, 'screw-dial': 0.75 };

/** Height of each screw's seat. */
const SCREW_SEATS = {
  trainScrew1: 5.8,
  trainScrew2: 5.8,
  trainScrew3: 5.8,
  barrelScrew1: 5,
  barrelScrew2: 5,
  ratchetScrew: 5.6,
  crownWheelScrew: 5.6,
  clickScrew: 5.5,
  palletScrew1: 5,
  palletScrew2: 5,
  cockScrew: 8.6,
  capScrew: 8.75,
  keylessScrew1: -4.2,
  keylessScrew2: -4.2,
  minuteScrew: -4.2,
  dialScrew1: 0,
  dialScrew2: 0,
};

const BUILDERS = {
  mainplate(mats) {
    const plate = disc(20, -2, 0, mats.plate, 96);
    const g = group(plate);
    // Pivot holes, jewelled: the marks that tell you where each wheel belongs.
    for (const p of [POS.centre, POS.third, POS.fourth, POS.escape, POS.pallet, POS.balance]) {
      g.add(jewel(p[0], p[1], 0, JEWEL_R, mats));
      g.add(jewel(p[0], p[1], -2, JEWEL_R, mats, -1));
    }
    g.add(post(POS.barrel[0], POS.barrel[1], 0, 0.04, 1, mats.darkSteel));
    g.add(post(POS.crownWheel[0], POS.crownWheel[1], 0, 0.04, 0.6, mats.darkSteel));
    // The groove the winding stem lies in.
    const groove = new THREE.BoxGeometry(1.5, 14, 0.04);
    groove.translate(0, 13, -2.02);
    g.add(new THREE.Mesh(groove, mats.darkSteel));
    return g;
  },

  drum(mats) {
    return group(
      gear(GEARS.barrel.teeth, GEARS.barrel.r, 0.3, 0.8, mats.wheel, 0),
      ring(GEARS.barrel.r - 0.5, GEARS.barrel.r - 1.1, 0.8, 3, mats.brass),
      disc(GEARS.barrel.r - 0.5, 0.3, 0.9, mats.brass),
    );
  },
  mainspring: (mats) => spiral(1.8, GEARS.barrel.r - 1.3, 7, 0.14, 1, 2.8, mats.blued),
  arbor: (mats) => group(post(0, 0, 0.1, 3.8, 1.6, mats.steel), post(0, 0, 3.8, 5.3, 0.9, mats.darkSteel)),
  barrelCover: (mats) => group(disc(GEARS.barrel.r - 0.4, 3, 3.3, mats.gold), post(0, 0, 3.3, 3.34, 1.7, mats.darkSteel)),

  fourth(mats) {
    return wheel(mats, {
      wheelZ: 1.1,
      wheelGear: 'fourth',
      pinionGear: 'fourthPinion',
      pinionZ: [1.8, 2.8],
      axle: [-5.6, 4.6],
      spokes: 4,
    });
  },
  third(mats) {
    return wheel(mats, {
      wheelZ: 2.3,
      wheelGear: 'third',
      pinionGear: 'thirdPinion',
      pinionZ: [2.8, 3.8],
      axle: [0, 4.6],
      spokes: 5,
    });
  },
  escape(mats) {
    return group(
      escapeGear(GEARS.escape.teeth, GEARS.escape.r, 3.4, 3.62, mats.steel),
      gear(GEARS.escapePinion.teeth, GEARS.escapePinion.r, 0.9, 1.7, mats.steel, 0),
      post(0, 0, 0, 4.6, 0.2, mats.steel, 12),
    );
  },
  centre(mats) {
    return wheel(mats, {
      wheelZ: 3.3,
      wheelGear: 'centre',
      pinionGear: 'centrePinion',
      pinionZ: [0.6, 2.2],
      axle: [-4.4, 4.6],
      spokes: 5,
    });
  },

  trainBridge(mats) {
    const o = PART_BY_ID.trainBridge.pos;
    const s1 = POS.trainScrew1;
    const s2 = POS.trainScrew2;
    const s3 = POS.trainScrew3;
    const g = bridge(
      mats,
      o,
      [
        [POS.centre, s1, 3.6],
        [POS.centre, s3, 3.6],
        [POS.centre, POS.third, 3.4],
        [POS.third, POS.fourth, 3.2],
        [POS.fourth, s2, 3.2],
        [POS.third, POS.escape, 3],
        [POS.fourth, POS.escape, 2.6],
      ],
      { z: [4.7, 5.8], posts: [s1, s2, s3] },
    );
    for (const p of [POS.centre, POS.third, POS.fourth, POS.escape]) {
      const [x, y] = rel(p, o);
      g.add(jewel(x, y, 5.8, JEWEL_R, mats));
    }
    return g;
  },

  barrelBridge(mats) {
    const o = POS.barrel;
    return bridge(
      mats,
      o,
      [
        [POS.barrel, POS.barrelScrew1, 4.6],
        [POS.barrel, POS.barrelScrew2, 4.6],
        [POS.barrel, POS.crownWheel, 4.8],
      ],
      { z: [3.9, 5], posts: [POS.barrelScrew1, POS.barrelScrew2, [POS.crownWheel[0] + 1, POS.crownWheel[1] + 2]] },
    );
  },

  ratchet: (mats) => group(gear(60, 5.2, 5, 5.6, mats.steel, 0), post(0, 0, 5.6, 5.64, 1.5, mats.darkSteel)),
  crownWheel: (mats) => group(gear(36, 3.4, 5, 5.6, mats.steel, 0), post(0, 0, 5.6, 5.64, 1.1, mats.darkSteel)),
  click: (mats) => flatShape([[-0.9, -0.5], [0.6, -0.9], [4.0, 1], [3.8, 1.6], [0.2, 0.9], [-0.9, 0.5]], 5, 5.5, mats.steel),
  clickSpring: (mats) => flatShape([[-0.2, 0], [2.4, -1.4], [2.6, -1.1], [0.2, 0.5]], 5, 5.3, mats.blued),

  pallet(mats) {
    const anchor = rel(POS.escape, POS.pallet);
    const toBalance = rel(POS.balance, POS.pallet);
    const a = Math.atan2(anchor[1], anchor[0]);
    const armTip = (spread) => [1.8 * Math.cos(a + spread), 1.8 * Math.sin(a + spread)];
    const fork = group(
      capsule([0, 0], armTip(0.55), 0.45, 3.4, 3.65, mats.steel),
      capsule([0, 0], armTip(-0.55), 0.45, 3.4, 3.65, mats.steel),
      capsule([0, 0], [toBalance[0] * 0.55, toBalance[1] * 0.55], 0.5, 3.4, 3.65, mats.steel),
      post(0, 0, 0, 5, 0.22, mats.steel, 12),
      post(...armTip(0.55), 3.3, 3.75, 0.2, mats.ruby, 8),
      post(...armTip(-0.55), 3.3, 3.75, 0.2, mats.ruby, 8),
    );
    return fork;
  },
  palletBridge(mats) {
    const o = POS.pallet;
    return bridge(
      mats,
      o,
      [
        [POS.pallet, POS.palletScrew1, 2.6],
        [POS.pallet, POS.palletScrew2, 2.6],
      ],
      { z: [4.2, 5], posts: [POS.palletScrew1, POS.palletScrew2] },
    );
  },

  balance(mats) {
    const g = group(
      ring(5.2, 4.7, 6.2, 6.7, mats.wheel, 64),
      capsule([-4.8, 0], [4.8, 0], 0.7, 6.2, 6.55, mats.wheel),
      post(0, 0, 0, 8.3, 0.2, mats.steel, 12),
      post(0, 0, 3.4, 3.8, 0.9, mats.steel, 16),
      post(0, 0, 6.15, 6.75, 0.7, mats.brass, 16),
      post(0.75, 0, 3.3, 3.8, 0.12, mats.ruby, 6),
    );
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      g.add(post(5.2 * Math.cos(a), 5.2 * Math.sin(a), 6.25, 6.65, 0.28, mats.gold, 8));
    }
    return g;
  },
  hairspring: (mats) => spiral(0.9, 3.4, 8, 0.045, 7, 7.25, mats.blued),
  cock(mats) {
    const o = POS.balance;
    const g = bridge(mats, o, [[POS.balance, POS.cock, 3.4]], {
      z: [7.8, 8.6],
      posts: [POS.cock],
    });
    const [x, y] = rel(POS.cock, o);
    g.add(post(x, y, 0, 7.8, 1.6, mats.brass));
    g.add(jewel(0, 0, 8.6, 0.8, mats));
    return g;
  },
  regulator(mats) {
    const toCentre = rel(POS.balance, POS.regulator);
    return flatShape(
      [[toCentre[0] - 0.5, toCentre[1] - 0.5], [toCentre[0] + 0.5, toCentre[1] + 0.5], [2.8, -1.6], [2.2, -2.4]],
      8.6,
      8.75,
      mats.steel,
    );
  },
  capJewel: (mats) => group(post(0, 0, 8.6, 8.75, 1.35, mats.steel), post(0, 0, 8.75, 8.88, 0.6, mats.ruby)),

  windingPinion: (mats) => stemBarrel(mats.steel, 1.3, 1.6),
  clutch: (mats) => stemBarrel(mats.steel, 1.2, 2.6),
  stem(mats) {
    const axis = new THREE.CylinderGeometry(0.42, 0.42, 17, 12);
    axis.translate(0, 1.5, -3); // from y=8 inside the plate to y=25 inside the crown
    return new THREE.Mesh(axis, mats.steel);
  },
  lever: (mats) => flatShape([[-1.4, -2.2], [-0.2, -2.8], [3, 3], [1.8, 3.6]], -3.2, -2.8, mats.steel),
  yoke: (mats) => flatShape([[-2.4, 3], [-1.5, 3.8], [3.2, -1.4], [2.4, -2.2]], -3.2, -2.8, mats.steel),
  keylessPlate(mats) {
    const o = POS.keylessPlate;
    return bridge(mats, o, [[POS.keylessScrew2, POS.keylessScrew1, 6.2]], {
      z: [-4.2, -3.6],
      zFloor: -2,
      posts: [POS.keylessScrew1, POS.keylessScrew2],
    });
  },

  cannon(mats) {
    return group(
      gear(GEARS.cannon.teeth, GEARS.cannon.r, -3, -2.2, mats.steel, 0),
      post(0, 0, -6.5, -2.2, 0.75, mats.steel, 16),
    );
  },
  minute(mats) {
    return group(
      gear(GEARS.minute.teeth, GEARS.minute.r, -3, -2.7, mats.wheel, 4),
      gear(GEARS.minutePinion.teeth, GEARS.minutePinion.r, -3.45, -3, mats.steel, 0),
      post(0, 0, -3.9, -2, 0.3, mats.steel, 12),
    );
  },
  minuteBridge(mats) {
    const o = POS.minuteBridge;
    return bridge(mats, o, [[POS.minute, POS.minuteScrew, 2.6]], {
      z: [-4.2, -3.6],
      zFloor: -2,
      posts: [POS.minuteScrew],
    });
  },
  hour(mats) {
    return group(gear(GEARS.hour.teeth, GEARS.hour.r, -3.45, -3.15, mats.wheel, 4), post(0, 0, -6.1, -3.15, 1.05, mats.brass, 18));
  },
  setting: (mats) => group(gear(24, 1.6, -3, -2.7, mats.wheel, 0), post(0, 0, -3.1, -2, 0.25, mats.steel, 12)),

  dial(mats) {
    const plate = disc(19.6, -5.28, -5, mats.gold, 96);
    const face = new THREE.CircleGeometry(19.3, 96);
    face.rotateY(Math.PI);
    face.translate(0, 0, -5.29);
    // Painted once: the dial is built again for the tray, the ghost and the drag.
    mats.enamel ??= new THREE.MeshStandardMaterial({
      map: createDialTexture(),
      roughness: 0.28,
      metalness: 0,
    });
    return group(plate, new THREE.Mesh(face, mats.enamel), post(0, 0, -5.34, -5.29, 1.1, mats.gold));
  },
  hourHand: (mats) => hand(mats.hand, -5.95, 8.6, 0.85, 1.15),
  minuteHand: (mats) => hand(mats.hand, -6.3, 13.2, 0.6, 0.9),
  secondsHand(mats) {
    return group(
      flatShape([[-0.1, -1], [0.1, -1], [0.05, 3.5], [-0.05, 3.5]], -5.75, -5.65, mats.hand),
      post(0, 0, -5.8, -5.6, 0.3, mats.hand, 12),
    );
  },

  case(mats) {
    // Rounded flanks catch the light in a band instead of flaring all at once.
    const body = turned(
      [
        [20.6, -8], [21.6, -8], [22.5, -7.6], [23.1, -6.6], [23.5, -4.5], [23.7, -1],
        [23.7, 2], [23.5, 5.5], [23.1, 8], [22.6, 9.4], [21.8, 9.8], [20.1, 9.8],
        [20.1, -7.2], [20.6, -8],
      ],
      mats.gold,
      128,
    );
    const glassDisc = disc(21, -7.7, -7.5, mats.glass, 64);
    const pendant = post(0, 22.6, 0, 1, 0.1, mats.gold);
    const neck = new THREE.CylinderGeometry(1.8, 2.2, 3, 16);
    neck.translate(0, 23.8, 0);
    const bow = new THREE.TorusGeometry(4.8, 0.55, 10, 40);
    bow.translate(0, 29.2, 0);
    return group(
      body,
      glassDisc,
      pendant,
      new THREE.Mesh(neck, mats.gold),
      new THREE.Mesh(bow, mats.gold),
    );
  },
  crown(mats) {
    const knurled = new THREE.CylinderGeometry(2.7, 2.7, 3.2, 24);
    knurled.translate(0, 2.6, 0);
    const stem = new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
    stem.translate(0, -1, 0);
    const g = group(new THREE.Mesh(knurled, mats.gold), new THREE.Mesh(stem, mats.steel));
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const rib = new THREE.BoxGeometry(0.28, 3, 0.2);
      rib.translate(2.72 * Math.cos(a), 2.6, 2.72 * Math.sin(a));
      g.add(new THREE.Mesh(rib, mats.brass));
    }
    return g;
  },
  caseBack(mats) {
    return turned(
      [[22.8, 9.8], [22, 10.3], [19, 10.75], [14, 11], [8, 11.15], [0, 11.2]],
      mats.gold,
      128,
    );
  },
};

/** A short barrel threaded on the winding stem, along y. */
function stemBarrel(material, radius, length) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
  geometry.translate(0, 0, -3);
  return new THREE.Mesh(geometry, material);
}

/** A blued Breguet-style hand: open moon near the tip. */
function hand(material, z, length, width, moon) {
  const shaft = flatShape(
    [[-width * 0.45, -1.8], [width * 0.45, -1.8], [width * 0.22, length * 0.68], [0, length], [-width * 0.22, length * 0.68]],
    z,
    z + 0.12,
    material,
  );
  const face = ring(moon, moon * 0.6, z, z + 0.12, material, 24);
  face.position.y = length * 0.68;
  return group(shaft, face, post(0, 0, z, z + 0.14, 1.15, material));
}

/** Builds a part at its own origin. Screws are built by kind and seat. */
export function buildPart(id, mats) {
  const part = PART_BY_ID[id];
  if (!part.screw) return BUILDERS[id](mats);
  return screw(SCREW_SEATS[id], SCREW_R[part.kind], mats, part.side === 'dial' ? -1 : 1);
}

/** Which arbor of the train turns a part when the watch runs, if any. */
export const SPIN = {
  drum: 'barrel',
  mainspring: 'barrel',
  barrelCover: 'barrel',
  fourth: 'fourth',
  third: 'third',
  escape: 'escape',
  centre: 'centre',
  cannon: 'cannon',
  minute: 'minute',
  hour: 'hour',
  pallet: 'pallet',
  balance: 'balance',
  hairspring: 'balance',
  hourHand: 'hourHand',
  minuteHand: 'minuteHand',
  secondsHand: 'secondsHand',
};
