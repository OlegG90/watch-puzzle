// The 3D stage: the movement, the camera, and the sums that turn a fingertip
// into "which slot did you mean". Picking is done in screen space on purpose: a
// generous radius around each slot, never a ray that must hit a tiny mesh.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { OIL_POINT_BY_ID } from '../game/oil.js';
import { PARTS, PART_BY_ID, onFace } from '../game/parts.js';
import { BEATS_PER_SECOND, dialSeconds, trainAngles } from '../game/train.js';
import { createMaterials } from './materials.js';
import { SPIN, buildPart } from './parts3d.js';
import { ring } from './shapes.js';
import { trayScale } from './trayScale.js';

const MIN_TOUCH_RADIUS = 44; // CSS px, the size of a comfortable fingertip target
const REST_PITCH = -0.2;
const REST_YAW = 0.14;
const LOOSE_LIFT = 1.3;
const DROP_LIFT = 5;
// How much must stay in view, in mm from the centre: the case across the screen,
// and the bow and crown up the screen.
const FIT_WIDTH = 25;
const FIT_HEIGHT = 36;
const SMOOTH_FRAME_MS = 1000 / 30;
const BEAT_FRAME_MS = 1000 / BEATS_PER_SECOND;
const SET_HANDS_MS = 1600;
const HINT_MS = 2600;
const MAX_ZOOM = 6;
const OIL_CLEAR_PX = 16; // a tap this much nearer one point than the next clearly means it
const OIL_FOCUS_ZOOM = 2.6; // close points stand a fingertip apart at this zoom
const OIL_FOCUS_MS = 420;
const OIL_MARKER_R = 0.7;
const OIL_DROP_R = 0.5;
const THUMB_PX = 128;
const THUMB_TILT = 0.45;

const easeOut = (t) => 1 - (1 - t) ** 3;

export class WatchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Redrawing shadows is the priciest thing here, so frame() decides when it happens.
    this.renderer.shadowMap.autoUpdate = false;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(26, 1, 1, 1000);
    this.key = new THREE.DirectionalLight(0xfff1dd, 1.3);
    this.key.position.set(-55, 70, 70);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -32, right: 32, top: 38, bottom: -32, near: 10, far: 220 });
    this.key.shadow.bias = -0.0006;
    this.scene.add(this.key);

    this.mats = createMaterials();
    this.watch = new THREE.Group();
    this.scene.add(this.watch);
    // The movement holder on the bench: marks where the first part goes, until the case replaces it.
    this.holder = ring(21.6, 20.3, -2.4, -0.6, this.mats.black);
    this.holder.receiveShadow = true;
    this.watch.add(this.holder);

    this.objects = new Map(); // part id → fitted object
    this.oilMarkers = new Map(); // open oil point id → marker
    this.oilDrops = new THREE.Group();
    this.watch.add(this.oilDrops);
    const dot = new THREE.SphereGeometry(1, 16, 12);
    // Markers draw over everything, since a point sits among the wheels; draw() hides the far side's.
    this.oilMarker = {
      geometry: dot,
      material: new THREE.MeshBasicMaterial({ color: 0x00c2ff, depthTest: false, transparent: true }),
    };
    this.oilDrop = {
      geometry: dot,
      material: new THREE.MeshStandardMaterial({ color: 0xd98f1e, roughness: 0.12, metalness: 0.1 }),
    };
    this.tweens = [];
    this.yaw = REST_YAW;
    this.pitch = REST_PITCH;
    this.zoom = 1;
    this.pan = new THREE.Vector2();
    this.drag = null;
    this.hintGhost = null;
    this.running = false;
    this.runStart = 0;
    this.backOpen = false;
    this.onBeat = null;

    this.needsRender = true;
    this.loopHandle = null;
    this.lastFrame = 0;
    this.lastBeat = -1;
    this.lastShadowSecond = -1;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.applyAngles();
    this.invalidate();
  }

  // ---- Frame loop: draws only when something has changed, to spare the battery.

  invalidate() {
    this.needsRender = true;
    if (this.loopHandle === null) this.loopHandle = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    this.loopHandle = null;
    this.stepTweens(now);
    if (this.needsRender) this.renderer.shadowMap.needsUpdate = true;
    if (this.running) {
      this.applyAngles(now);
      // With the back on, only the hands show, and they move once per beat.
      const smooth = this.backOpen || now - this.runStart < SET_HANDS_MS;
      const interval = smooth ? SMOOTH_FRAME_MS : BEAT_FRAME_MS;
      this.needsRender = this.needsRender || now - this.lastFrame >= interval;
    }
    if (this.needsRender) {
      this.lastFrame = now;
      this.needsRender = false;
      this.draw();
    }
    if (this.running || this.tweens.length || this.hintGhost) {
      this.loopHandle = requestAnimationFrame((t) => this.frame(t));
    }
  }

  draw() {
    this.syncPose();
    const side = this.facing();
    for (const marker of this.oilMarkers.values()) marker.visible = onFace(marker.userData.point, side);
    this.renderer.render(this.scene, this.camera);
  }

  /** Applies the view to the matrices. Cheap: the watch's parts are not walked. */
  syncPose() {
    this.watch.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
    this.watch.updateMatrix();
    this.watch.matrixWorld.copy(this.watch.matrix);
    this.camera.position.set(this.pan.x, this.pan.y, this.baseDistance / this.zoom);
    this.camera.updateMatrixWorld();
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    this.width = box.width;
    this.height = box.height;
    this.renderer.setSize(box.width, box.height, false);
    this.camera.aspect = box.width / box.height;
    this.camera.updateProjectionMatrix();
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    this.baseDistance = Math.max(FIT_HEIGHT, FIT_WIDTH / this.camera.aspect) / Math.tan(halfFov);
    this.invalidate();
  }

  addTween(durationMs, step, done) {
    this.tweens.push({ start: performance.now(), durationMs, step, done });
    this.invalidate();
  }

  stepTweens(now) {
    if (!this.tweens.length) return;
    this.tweens = this.tweens.filter((tween) => {
      const t = Math.min(1, Math.max(0, (now - tween.start) / tween.durationMs));
      tween.step(easeOut(t));
      if (t < 1) return true;
      tween.done?.();
      return false;
    });
    this.needsRender = true;
  }

  // ---- The movement

  makeObject(id) {
    const object = buildPart(id, this.mats);
    object.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = !m.material.transparent;
        m.receiveShadow = !m.material.transparent;
      }
    });
    return object;
  }

  /** Puts a new game on the bench, or a saved one, with no animation. */
  load(game) {
    this.clear();
    for (const part of PARTS) {
      if (!game.isInstalled(part.id)) continue;
      const object = this.fit(part.id);
      if (part.screw && !game.tightened.has(part.id)) object.position.z = this.liftSign(part) * LOOSE_LIFT;
    }
    this.syncOil(game);
    this.applyAngles();
    this.invalidate();
  }

  /** Shows a marker on each point waiting for oil and a drop on each oiled one. */
  syncOil(game) {
    this.clearOil();
    for (const point of game.openOilPoints()) {
      const marker = new THREE.Mesh(this.oilMarker.geometry, this.oilMarker.material);
      marker.position.set(...point.pos, point.hitZ);
      marker.scale.setScalar(OIL_MARKER_R);
      marker.renderOrder = 10;
      marker.userData.point = point;
      this.watch.add(marker);
      this.oilMarkers.set(point.id, marker);
    }
    for (const id of game.oiled) {
      const point = OIL_POINT_BY_ID[id];
      const drop = new THREE.Mesh(this.oilDrop.geometry, this.oilDrop.material);
      const outwards = point.side === 'train' ? 1 : -1;
      drop.position.set(...point.pos, point.hitZ + outwards * OIL_DROP_R * 0.5);
      drop.scale.set(OIL_DROP_R, OIL_DROP_R, OIL_DROP_R * 0.6);
      this.oilDrops.add(drop);
    }
    this.invalidate();
  }

  clearOil() {
    for (const marker of this.oilMarkers.values()) this.watch.remove(marker);
    this.oilMarkers.clear();
    this.oilDrops.clear();
  }

  /** Pulses a marker, to show where the hint means. */
  pulseOilPoint(point) {
    const marker = this.oilMarkers.get(point.id);
    if (!marker) return;
    this.addTween(HINT_MS, (t) => {
      marker.scale.setScalar(OIL_MARKER_R * (1.4 + Math.sin(t * Math.PI * 8) * 0.8 * (1 - t)));
    });
  }

  clear() {
    this.endDrag();
    this.clearHint();
    this.stopRunning();
    this.tweens = [];
    this.clearOil();
    for (const object of this.objects.values()) {
      this.watch.remove(object);
      disposeObject(object);
    }
    this.objects.clear();
    this.holder.visible = true;
    this.backOpen = false;
    this.resetView(false);
  }

  /** A new object for this part, standing at its slot. */
  makePlaced(id) {
    const object = this.makeObject(id);
    object.position.set(...PART_BY_ID[id].pos, 0);
    return object;
  }

  fit(id) {
    const object = this.makePlaced(id);
    this.watch.add(object);
    this.objects.set(id, object);
    if (id === 'case') this.holder.visible = false;
    return object;
  }

  /** Which way a part lifts off the movement: towards the side it is fitted from. */
  liftSign(part) {
    if (part.side === 'train') return 1;
    if (part.side === 'dial') return -1;
    return this.facing() === 'train' ? 1 : -1;
  }

  /** Lowers a part into place, optionally leaving a screw standing proud. */
  install(id, { loose = false } = {}) {
    const part = PART_BY_ID[id];
    const object = this.fit(id);
    this.applyAngles();
    const sign = this.liftSign(part);
    const rest = loose ? sign * LOOSE_LIFT : 0;
    const from = sign * DROP_LIFT;
    object.position.z = from;
    this.addTween(240, (t) => {
      object.position.z = from + (rest - from) * t;
    });
  }

  tighten(id) {
    const object = this.objects.get(id);
    if (!object) return;
    const from = object.position.z;
    this.addTween(420, (t) => {
      object.position.z = from * (1 - t);
      object.rotation.z = t * Math.PI * 4;
    });
  }

  /** @param {number} [now] frame time; omitted, the watch shows its stopped pose */
  applyAngles(now) {
    let angles;
    if (this.running && now !== undefined) {
      const real = dialSeconds(new Date());
      // After winding, the hands sweep round from where they stood to the true time.
      const t = Math.min(1, (now - this.runStart) / SET_HANDS_MS);
      const seconds = t < 1 ? easeOut(t) * real : real;
      angles = trainAngles(seconds);
      const beat = Math.floor(real * BEATS_PER_SECOND);
      if (t >= 1 && beat !== this.lastBeat) {
        this.lastBeat = beat;
        this.onBeat?.();
      }
      // Shadows refresh once a second, and throughout the sweep, so the hands' keep up.
      const second = Math.floor(real);
      if (t < 1 || second !== this.lastShadowSecond) {
        this.lastShadowSecond = second;
        this.renderer.shadowMap.needsUpdate = true;
      }
    } else {
      angles = trainAngles(0);
    }
    for (const [id, object] of this.objects) {
      const arbor = SPIN[id];
      if (arbor) object.rotation.z = angles[arbor];
    }
  }

  startRunning({ sweep = true } = {}) {
    this.running = true;
    this.runStart = sweep ? performance.now() : -Infinity;
    this.invalidate();
  }

  stopRunning() {
    this.running = false;
  }

  setBackOpen(open) {
    this.backOpen = open;
    const back = this.objects.get('caseBack');
    if (back) back.visible = !open;
    this.invalidate();
  }

  // ---- The view

  facing() {
    // Pitch stays within a right angle, so yaw alone decides which face is up.
    return Math.cos(this.yaw) >= 0 ? 'train' : 'dial';
  }

  orbit(dx, dy) {
    this.yaw += dx * 0.008;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.008, -1.2, 1.2);
    this.invalidate();
  }

  zoomBy(factor) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 1, MAX_ZOOM);
    this.clampPan();
    this.invalidate();
  }

  panBy(dx, dy) {
    const worldPerPx = (2 * this.viewHalfHeight()) / this.height;
    this.pan.x -= dx * worldPerPx;
    this.pan.y += dy * worldPerPx;
    this.clampPan();
    this.invalidate();
  }

  viewHalfHeight() {
    return (this.baseDistance / this.zoom) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  clampPan() {
    const limit = 26 * (1 - 1 / this.zoom);
    this.pan.clampScalar(-limit, limit);
  }

  /** Turns the watch over to show the other face. */
  flip() {
    this.turnTo(this.facing() === 'train' ? 'dial' : 'train');
  }

  turnTo(side) {
    const target = side === 'train' ? REST_YAW : Math.PI - REST_YAW;
    const turns = Math.round((this.yaw - target) / (Math.PI * 2));
    const toYaw = target + turns * Math.PI * 2;
    const [fromYaw, fromPitch] = [this.yaw, this.pitch];
    this.addTween(520, (t) => {
      this.yaw = fromYaw + (toYaw - fromYaw) * t;
      this.pitch = fromPitch + (REST_PITCH - fromPitch) * t;
    });
  }

  resetView(animate = true) {
    if (animate) {
      this.turnTo(this.facing());
    } else {
      this.yaw = REST_YAW;
      this.pitch = REST_PITCH;
    }
    this.zoom = 1;
    this.pan.set(0, 0);
    this.invalidate();
  }

  // ---- Fingers to slots

  /** Where a local point appears on screen, in px relative to the canvas. */
  toScreen(x, y, z) {
    this.syncPose();
    const v = new THREE.Vector3(x, y, z).applyMatrix4(this.watch.matrixWorld).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  /** A slot's screen position and how far from it a touch still counts. */
  slotTarget(part) {
    const c = this.toScreen(part.pos[0], part.pos[1], part.hitZ);
    const e = this.toScreen(part.pos[0] + part.hitR, part.pos[1], part.hitZ);
    return { x: c.x, y: c.y, radius: Math.max(MIN_TOUCH_RADIUS, Math.hypot(e.x - c.x, e.y - c.y)) };
  }

  /** The nearest of these parts within its touch radius, of those on the visible side. */
  nearest(parts, x, y) {
    this.syncPose();
    const side = this.facing();
    let best = null;
    let bestScore = Infinity;
    for (const part of parts) {
      if (!onFace(part, side)) continue;
      const target = this.slotTarget(part);
      const distance = Math.hypot(target.x - x, target.y - y);
      if (distance > target.radius) continue;
      // Compare relative to size, so a screw beats the plate beneath it.
      const score = distance / target.radius;
      if (score < bestScore) {
        best = part;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * The oil point under a fingertip. A wrong oil costs a mistake, so when a tap falls
   * about as near to two points, `unclear` says so instead of guessing.
   * @returns {{point: object|null, unclear: boolean}}
   */
  oilPointAt(points, x, y) {
    this.syncPose();
    const side = this.facing();
    const near = points
      .filter((p) => onFace(p, side))
      .map((point) => ({ point, ...this.slotTarget(point) }))
      .map((t) => ({ ...t, distance: Math.hypot(t.x - x, t.y - y) }))
      .filter((t) => t.distance <= t.radius)
      .sort((a, b) => a.distance - b.distance);
    const [first, second] = near;
    if (!first) return { point: null, unclear: false };
    return { point: first.point, unclear: Boolean(second) && second.distance - first.distance < OIL_CLEAR_PX };
  }

  /** Moves in on a point, so that its neighbours stand apart. Closer each time it is needed. */
  focusOn(point) {
    this.syncPose();
    const target = new THREE.Vector3(...point.pos, point.hitZ).applyMatrix4(this.watch.matrixWorld);
    const fromZoom = this.zoom;
    const toZoom = Math.min(MAX_ZOOM, Math.max(fromZoom * 1.5, OIL_FOCUS_ZOOM));
    const fromPan = this.pan.clone();
    this.addTween(OIL_FOCUS_MS, (t) => {
      this.zoom = fromZoom + (toZoom - fromZoom) * t;
      this.pan.set(fromPan.x + (target.x - fromPan.x) * t, fromPan.y + (target.y - fromPan.y) * t);
      this.clampPan();
    });
  }

  /** Canvas px → the point on the part's own working height, in movement coordinates. */
  toLocal(x, y, z) {
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2);
    this.syncPose();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const inverse = this.watch.matrixWorld.clone().invert();
    const ray = raycaster.ray.clone().applyMatrix4(inverse);
    const point = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
    return ray.intersectPlane(plane, point) ? point : null;
  }

  // ---- Dragging a part

  startDrag(part) {
    this.endDrag();
    const object = this.makeObject(part.id);
    this.drag = { part, object };
    this.watch.add(object);
    object.visible = false;
    this.invalidate();
  }

  /** Moves the held part; snaps onto `snapPart` when the finger is close enough. */
  moveDrag(x, y, snapPart) {
    if (!this.drag) return;
    const { part, object } = this.drag;
    const lift = this.liftSign(part) * 2.2;
    let at;
    if (snapPart) at = new THREE.Vector3(snapPart.pos[0], snapPart.pos[1], lift);
    else at = this.toLocal(x, y, part.hitZ);
    if (!at) return;
    object.visible = true;
    object.position.set(at.x, at.y, lift);
    if (object.userData.snapped !== Boolean(snapPart)) {
      object.userData.snapped = Boolean(snapPart);
      this.setGlow(object, snapPart ? 0x332200 : 0x000000);
    }
    this.invalidate();
  }

  setGlow(object, hex) {
    object.traverse((m) => {
      if (!m.isMesh || !m.material.emissive) return;
      if (!m.userData.glowMaterial) {
        m.userData.glowMaterial = true;
        m.material = m.material.clone();
      }
      m.material.emissive.setHex(hex);
    });
  }

  endDrag() {
    if (!this.drag) return;
    this.watch.remove(this.drag.object);
    disposeObject(this.drag.object, true);
    this.drag = null;
    this.invalidate();
  }

  // ---- Hints

  /** A pulsing translucent copy of the part, in the place it belongs. */
  showHint(part) {
    this.clearHint();
    const ghost = this.makeObject(part.id);
    ghost.position.set(part.pos[0], part.pos[1], this.liftSign(part) * 0.6);
    ghost.traverse((m) => {
      if (!m.isMesh) return;
      m.material = m.material.clone();
      m.material.transparent = true;
      m.material.depthTest = false;
      if (m.material.emissive) m.material.emissive.setHex(0x664400);
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 10;
    });
    this.watch.add(ghost);
    this.hintGhost = ghost;
    this.addTween(HINT_MS, (t) => {
      const pulse = 0.5 + 0.35 * Math.sin(t * Math.PI * 8);
      ghost.traverse((m) => {
        if (m.isMesh) m.material.opacity = pulse;
      });
    }, () => {
      if (this.hintGhost === ghost) this.clearHint();
    });
  }

  clearHint() {
    if (!this.hintGhost) return;
    this.watch.remove(this.hintGhost);
    disposeObject(this.hintGhost, true);
    this.hintGhost = null;
    this.invalidate();
  }

  // ---- Tray pictures

  /** Renders one picture per part. Call while the canvas is hidden behind the splash. */
  thumbnails(ids) {
    const shots = ids.map((id) => ({ key: id, ids: [id], side: PART_BY_ID[id].side }));
    return this.stills(shots, THUMB_PX, THUMB_TILT, trayScale);
  }

  /**
   * Renders still pictures of groups of parts, fully assembled and framed to fit.
   * @param {{key: string, ids: string[], side: string}[]} shots
   * @param {(mm: number) => number} fill how much of the picture a subject this large should fill
   * @returns {Map<string, string>} key → image data URL
   */
  stills(shots, size, tilt, fill = () => 1) {
    const stage = new THREE.Scene();
    stage.environment = this.scene.environment;
    stage.environmentIntensity = 0.7; // brighter than the bench: pictures sit on a dark card
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(-1, 2, 3);
    stage.add(light);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    const angles = trainAngles(0);

    const pictures = new Map();
    for (const shot of shots) {
      const holder = new THREE.Group();
      for (const id of shot.ids) {
        const object = this.makePlaced(id);
        if (SPIN[id]) object.rotation.z = angles[SPIN[id]];
        holder.add(object);
      }
      // Top edge away from the viewer, on either face, so both catch the same light.
      holder.rotation.set(-tilt, shot.side === 'dial' ? Math.PI : 0, 0, 'XYZ');
      stage.add(holder);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      const centre = box.getCenter(new THREE.Vector3());
      const dims = box.getSize(new THREE.Vector3());
      const extent = Math.max(dims.x, dims.y, 0.5);
      const half = (extent * 0.56) / fill(extent);
      Object.assign(camera, { left: -half, right: half, top: half, bottom: -half });
      camera.position.set(centre.x, centre.y, box.max.z + 50);
      camera.lookAt(centre.x, centre.y, centre.z);
      camera.updateProjectionMatrix();
      this.renderer.render(stage, camera);
      pictures.set(shot.key, this.canvas.toDataURL('image/png'));
      stage.remove(holder);
      disposeObject(holder);
    }
    this.renderer.setPixelRatio(ratio);
    this.resize();
    return pictures;
  }
}

/** Frees geometry; `ownMaterials` also frees the per-object material clones. */
function disposeObject(object, ownMaterials = false) {
  object.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry.dispose();
    if (ownMaterials && (m.userData.glowMaterial || m.material.transparent)) m.material.dispose();
  });
}
