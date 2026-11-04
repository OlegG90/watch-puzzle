// The game screen: connects the rules (Game), the stage (WatchScene) and the DOM.

import { LEVELS, PARTS, REFERENCE_VIEWS, onFace } from './game/parts.js';
import {
  LANGUAGES, getLanguage, gradeLabel, levelName, levelNote, partDesc, partName, setLanguage, t,
} from './i18n/index.js';
import { Game, MAX_STARS, TOOLS, grade } from './game/state.js';
import { WatchScene } from './render/scene.js';
import { Sound, buzz } from './ui/audio.js';
import { attachStageGestures } from './ui/gestures.js';
import { attachScrollHint } from './ui/scrollHint.js';
import { VERSION } from './version.js';

const SAVE_KEY = 'godynnykar.save.v1';
const RECORDS_KEY = 'godynnykar.records.v1';
const SOUND_KEY = 'godynnykar.sound.v1';
const LANGUAGE_KEY = 'godynnykar.language.v1';
const WIND_CLICKS = 24;
const WIND_PX_PER_CLICK = 16;
const DRAG_START_PX = 8;
const BACK_VIEW_PX = 480;
const REFERENCE_PX = 720;
const REFERENCE_TILT = 0.12;
const FINGER_CLEARANCE = 64; // the held part floats above the finger, so it stays visible

const $ = (id) => document.getElementById(id);
const dom = {
  hud: $('hud'), tools: $('tools'), bench: $('bench'), tray: $('tray'), info: $('info'),
  infoTitle: $('info-title'), infoText: $('info-text'), toast: $('toast'), menu: $('menu'),
  menuButtons: $('menu-buttons'), result: $('result'), splash: $('splash'), stage: $('stage'),
  canvas: $('watch-canvas'), progressText: $('progress-text'), progressFill: document.querySelector('#progress-bar span'),
  timer: $('timer'), btnTool: $('btn-tool'), btnFlip: $('btn-flip'), looseBadge: $('loose-badge'),
  wind: $('wind'), windStrip: $('wind-strip'), windFill: document.querySelector('#wind-bar span'),
  admire: $('admire'), btnBack: $('btn-admire-back'), btnSound: $('btn-sound'),
  btnLang: $('btn-lang'), menuLang: $('menu-lang'),
  reference: $('reference'), referenceViews: $('reference-views'), viewPanel: $('view-panel'),
};

// Private windows and full disks make storage throw. The game must still play.
const store = {
  read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Nothing to do: progress just will not survive a reload.
    }
  },
};

const sound = new Sound(store.read(SOUND_KEY) !== false);
const updateTrayHint = attachScrollHint(dom.tray);

const OVERLAYS = [dom.reference, dom.viewPanel];

let scene;
let thumbs;
let game = null;
let selectedKind = null;
let timerHandle = null;
let timerFrom = 0;
let toastHandle = null;
let windClicks = 0;
let heldCard = false; // one part at a time: a second finger on the tray is ignored
let infoPart = null; // what the info panel describes; null shows the instructions

// ---- Screens

function show(screen) {
  for (const s of [dom.menu, dom.result, ...OVERLAYS]) s.hidden = s !== screen;
}

function setPlaying(playing) {
  document.body.classList.toggle('playing', playing);
  dom.hud.hidden = !playing;
  dom.bench.hidden = !playing;
  syncBenchHeight();
}

/** Which of the bench's three panels is showing. */
function showPanel(panel) {
  dom.tray.hidden = panel !== 'tray';
  dom.info.hidden = panel !== 'tray';
  dom.wind.hidden = panel !== 'wind';
  dom.admire.hidden = panel !== 'admire';
  dom.tools.hidden = panel !== 'tray';
  syncBenchHeight();
}

function syncBenchHeight() {
  const h = dom.bench.hidden ? 0 : dom.bench.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--bench-h', `${h}px`);
}

function renderMenu() {
  stopTimer();
  scene.clear();
  game = null;
  setPlaying(false);
  dom.tools.hidden = true;
  fillMenu();
  show(dom.menu);
}

function fillMenu() {
  dom.menuButtons.replaceChildren();
  const records = store.read(RECORDS_KEY) ?? {};
  const saved = store.read(SAVE_KEY);
  if (LEVELS.includes(saved?.level)) {
    const g = new Game(saved.level, saved);
    const note = t('resumeNote', { level: levelName(saved.level), placed: g.placed, total: g.total });
    dom.menuButtons.append(menuButton(t('resume'), note, () => startGame(saved.level, saved)));
  }
  for (const level of LEVELS) {
    const best = records[level];
    const bestText = best ? t('bestScore', { stars: '★'.repeat(best.stars), time: formatTime(best.ms) }) : '';
    const button = menuButton(
      t('newGame', { level: levelName(level) }),
      `${levelNote(level)}${bestText}`,
      () => startGame(level),
    );
    if (saved) button.classList.add('ghost');
    dom.menuButtons.append(button);
  }
}

function menuButton(title, subtitle, onClick) {
  const button = document.createElement('button');
  button.className = 'big-btn';
  button.textContent = title;
  const small = document.createElement('small');
  small.textContent = subtitle;
  button.append(small);
  button.addEventListener('click', () => {
    sound.unlock();
    onClick();
  });
  return button;
}

// ---- Starting and saving

function startGame(level, saved = null) {
  // A new game replaces the save, so ask before throwing real progress away.
  const existing = store.read(SAVE_KEY);
  if (!saved && existing?.installed?.length && !existing.wound && !confirm(t('confirmRestart'))) return;
  game = new Game(level, saved);
  selectedKind = null;
  windClicks = 0;
  scene.load(game);
  show(null);
  setPlaying(true);
  history.pushState({ game: true }, '');
  if (game.wound) {
    enterAdmire({ sweep: false });
    return;
  }
  startTimer();
  refresh();
  setInfo(null);
}

function save() {
  if (!game) return;
  if (!document.hidden) syncElapsed();
  store.write(SAVE_KEY, game);
}

/** Brings the running clock up to date; between ticks it can lag by a second. */
function syncElapsed() {
  if (timerHandle !== null) game.elapsedMs = performance.now() - timerFrom;
}

function startTimer() {
  stopTimer();
  timerFrom = performance.now() - game.elapsedMs;
  timerHandle = setInterval(() => {
    if (document.hidden) return;
    syncElapsed();
    dom.timer.textContent = formatTime(game.elapsedMs);
  }, 1000);
  dom.timer.textContent = formatTime(game.elapsedMs);
}

function stopTimer() {
  if (timerHandle === null) return;
  syncElapsed();
  clearInterval(timerHandle);
  timerHandle = null;
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---- The bench

function renderProgress() {
  dom.progressText.textContent = game.wound
    ? levelName(game.level)
    : t('progressText', { level: levelName(game.level), placed: game.placed, total: game.total });
  dom.progressFill.style.width = game.wound ? '100%' : `${(game.placed / game.total) * 100}%`;
}

function refresh() {
  renderProgress();

  const loose = game.looseScrews().length;
  dom.looseBadge.hidden = loose === 0;
  dom.looseBadge.textContent = loose;
  dom.btnTool.classList.toggle('nudge', loose > 0 && game.tool !== TOOLS.SCREWDRIVER);
  if (loose === 0 && game.tool === TOOLS.SCREWDRIVER) setTool(TOOLS.TWEEZERS);

  renderTray();

  if (game.assembled) enterWinding();
  else showPanel('tray');
  save();
}

function renderTray() {
  const stacks = game.trayStacks();
  if (selectedKind && !stacks.some((s) => s.kind === selectedKind)) selectedKind = null;
  const previous = new Map([...dom.tray.children].map((c) => [c.dataset.kind, c]));
  const cards = stacks.map((stack) => {
    const card = previous.get(stack.kind) ?? makeCard(stack);
    card.classList.toggle('selected', stack.kind === selectedKind);
    card.setAttribute('aria-selected', stack.kind === selectedKind);
    const badge = card.querySelector('b');
    badge.hidden = stack.count < 2;
    badge.textContent = stack.count;
    card.querySelector('.name').textContent = partName(stack.part);
    return card;
  });
  // Touching a card's neighbours would lose an active drag or the scroll position.
  const same = cards.length === dom.tray.children.length && cards.every((c, i) => c === dom.tray.children[i]);
  if (!same) {
    dom.tray.replaceChildren(...cards);
    updateTrayHint();
  }
}

function makeCard(stack) {
  const card = document.createElement('button');
  card.className = 'card';
  card.dataset.kind = stack.kind;
  card.setAttribute('role', 'option');
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.src = thumbs.get(stack.kind);
  const name = document.createElement('span');
  name.className = 'name';
  const badge = document.createElement('b');
  card.append(img, name, badge);
  attachCardGestures(card, stack.kind);
  return card;
}

/** A tap selects; a pull out of the tray picks the part up with the finger. */
function attachCardGestures(card, kind) {
  card.addEventListener('pointerdown', (e) => {
    if (heldCard) return;
    heldCard = true;
    sound.unlock();
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (!game) return; // the Back button left the game mid-gesture
      if (!dragging && pullsOutOfTray(ev, start)) {
        dragging = true;
        beginDrag(kind, card);
      }
      if (dragging) {
        ev.preventDefault();
        updateDrag(kind, ev);
      }
    };
    const finish = (ev, cancelled) => {
      if (ev.pointerId !== e.pointerId) return;
      heldCard = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (!game) return;
      if (dragging) finishDrag(kind, ev, cancelled, card);
      // A cancel without a drag means the browser took the touch to scroll the tray.
      else if (!cancelled && !moved(ev, start)) toggleSelect(kind);
    };
    const onUp = (ev) => finish(ev, false);
    const onCancel = (ev) => finish(ev, true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });
  // Keyboard activation arrives as a click with no pointer behind it.
  card.addEventListener('click', (e) => {
    if (e.detail === 0) toggleSelect(kind);
  });
}

const moved = (ev, start) => Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > DRAG_START_PX;

/**
 * A finger moving along the tray is scrolling it, and only one moving across it
 * lifts the part. A mouse has no scrolling to confuse this with.
 */
function pullsOutOfTray(ev, start) {
  if (!moved(ev, start)) return false;
  if (ev.pointerType === 'mouse') return true;
  const dx = Math.abs(ev.clientX - start.x);
  const dy = Math.abs(ev.clientY - start.y);
  return getComputedStyle(dom.tray).touchAction.includes('pan-y') ? dx > dy : dy > dx;
}

function toggleSelect(kind) {
  selectedKind = selectedKind === kind ? null : kind;
  setTool(TOOLS.TWEEZERS);
  renderTray();
  setInfo(selectedKind ? game.openSlots(kind)[0] : null);
}

function setInfo(part) {
  infoPart = part;
  dom.infoTitle.textContent = part ? partName(part) : t('pickTitle');
  dom.infoText.textContent = part ? partDesc(part) : t('pickText');
}

function setTool(tool) {
  game.tool = tool;
  dom.btnTool.classList.toggle('active', tool === TOOLS.SCREWDRIVER);
}

// ---- Toasts

function toast(message, bad = false) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('bad', bad);
  dom.toast.hidden = false;
  clearTimeout(toastHandle);
  toastHandle = setTimeout(hideToast, bad ? 3600 : 2400);
}

function hideToast() {
  clearTimeout(toastHandle);
  dom.toast.hidden = true;
}

// ---- Dragging and placing

function localPoint(clientX, clientY) {
  const box = dom.canvas.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

/** Touch hides what it points at, so the working point rides above the finger. */
function dragPoint(ev) {
  const p = localPoint(ev.clientX, ev.clientY);
  if (ev.pointerType === 'touch') p.y -= FINGER_CLEARANCE;
  return p;
}

function beginDrag(kind, card) {
  selectedKind = kind;
  setTool(TOOLS.TWEEZERS);
  renderTray();
  card.classList.add('lifted');
  const slots = game.openSlots(kind);
  setInfo(slots[0]);
  scene.startDrag(slots[0]);
}

function updateDrag(kind, ev) {
  const p = dragPoint(ev);
  scene.moveDrag(p.x, p.y, slotAt(kind, p.x, p.y));
}

function finishDrag(kind, ev, cancelled, card) {
  card.classList.remove('lifted');
  scene.endDrag();
  if (cancelled) return;
  const p = dragPoint(ev);
  // Let go off the watch's stage: they changed their mind, which is no mistake.
  const stage = dom.canvas.getBoundingClientRect();
  if (ev.clientY > stage.bottom || ev.clientX > stage.right || ev.clientY < stage.top) return;
  attemptPlace(kind, p.x, p.y);
}

/** The slot under this point, preferring one the part can go in right now. */
function slotAt(kind, x, y) {
  const slots = game.openSlots(kind);
  return scene.nearest(slots.filter((s) => game.canFit(s)), x, y) ?? scene.nearest(slots, x, y);
}

function attemptPlace(kind, x, y) {
  const slots = game.openSlots(kind);
  const slot = slotAt(kind, x, y);
  if (slot) {
    const result = game.place(slot.id);
    if (result.ok) onPlaced(slot, result.auto);
    else onRefused(result);
    return;
  }
  // Every slot is on the other face: the player's aim may be right, so no penalty.
  const side = scene.facing();
  if (!slots.some((s) => onFace(s, side))) {
    toast(t('otherSide'));
    dom.btnFlip.classList.add('nudge');
    sound.wrong();
    return;
  }
  game.miss();
  toast(t('wrongSpot', { name: partName(slots[0]) }), true);
  sound.wrong();
  buzz(30);
  save();
}

function onPlaced(slot, autoFitted) {
  scene.clearHint();
  scene.install(slot.id, { loose: slot.screw });
  for (const p of autoFitted) scene.install(p.id);
  sound.place();
  buzz(12);
  dom.btnFlip.classList.remove('nudge');
  setInfo(slot);
  if (slot.screw && game.looseScrews().length === 1) {
    toast(t('screwLoose'));
  }
  refresh();
}

function onRefused(result) {
  sound.wrong();
  buzz(30);
  if (result.reason === 'loose') {
    toast(t('tightenFirst'), true);
    dom.btnTool.classList.add('nudge');
  } else {
    const names = result.missing.slice(0, 2).map(partName).join(', ');
    toast(t('fitFirst', { names }), true);
  }
  save();
}

// ---- Tapping the watch

function onStageTap(x, y) {
  sound.unlock();
  if (!game || game.wound || game.assembled) return;
  if (game.tool === TOOLS.SCREWDRIVER) {
    const screw = scene.nearest(game.looseScrews(), x, y);
    if (!screw) {
      toast(t(game.looseScrews(scene.facing()).length ? 'tapLooseScrew' : 'looseOnOtherSide'));
      return;
    }
    game.tighten(screw.id);
    scene.tighten(screw.id);
    sound.turn();
    buzz(12);
    refresh();
    return;
  }
  if (selectedKind) {
    attemptPlace(selectedKind, x, y);
    return;
  }
  const part = scene.nearest(game.visibleParts(), x, y);
  if (part) setInfo(part);
}

// ---- Tool buttons

function onToolButton() {
  sound.unlock();
  dom.btnTool.classList.remove('nudge');
  if (game.tool === TOOLS.SCREWDRIVER) {
    setTool(TOOLS.TWEEZERS);
    return;
  }
  if (!game.looseScrews().length) {
    toast(t('noLooseScrews'));
    return;
  }
  setTool(TOOLS.SCREWDRIVER);
  selectedKind = null;
  renderTray();
  // A loose screw on the far face would be unreachable, so turn the watch round.
  if (!game.looseScrews(scene.facing()).length) scene.turnTo(game.looseScrews()[0].side);
  toast(t('tapToTighten'));
}

function onHint() {
  sound.unlock();
  const suggestion = game.suggest(selectedKind);
  if (!suggestion) return;
  game.hints += 1;
  const { type, part } = suggestion;
  if (!onFace(part, scene.facing())) scene.turnTo(part.side);
  if (type === 'tighten') {
    setTool(TOOLS.SCREWDRIVER);
    selectedKind = null;
    toast(t('hintTighten', { name: partName(part).toLowerCase() }));
  } else {
    if (selectedKind && selectedKind !== part.kind) {
      toast(t('hintTooEarly', { name: partName(part) }));
    } else {
      toast(t('hintPlace', { name: partName(part) }));
    }
    selectedKind = part.kind;
    setTool(TOOLS.TWEEZERS);
    renderTray();
    setInfo(part);
    const card = [...dom.tray.children].find((c) => c.dataset.kind === part.kind);
    card?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  scene.showHint(part);
  refresh();
}

// ---- Reference pictures

/** Drawn on first use, since most games may never need them. */
function buildReference() {
  const pictures = scene.stills(REFERENCE_VIEWS, REFERENCE_PX, REFERENCE_TILT);
  for (const view of REFERENCE_VIEWS) {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = pictures.get(view.key);
    img.alt = '';
    img.draggable = false;
    const caption = document.createElement('figcaption');
    caption.dataset.i18n = view.key;
    caption.textContent = t(view.key);
    figure.append(img, caption);
    dom.referenceViews.append(figure);
  }
}

/** The back of the watch, for the menu and the View panel. Rendered once, at start-up. */
function renderBackView() {
  const view = REFERENCE_VIEWS.find((v) => v.key === 'refTrainSide');
  try {
    const picture = scene.stills([view], BACK_VIEW_PX, REFERENCE_TILT).get(view.key);
    for (const img of document.querySelectorAll('.back-view')) img.src = picture;
  } catch (error) {
    console.warn('The back view could not be drawn', error); // the game plays without it
  }
}

/** A full-screen panel over the game. Looking is free, and that includes the clock. */
function openOverlay(screen) {
  sound.unlock();
  stopTimer();
  show(screen);
  screen.scrollTop = 0;
  // An entry of its own, so the phone's Back button closes the panel, not the game.
  history.pushState({ game: true, overlay: true }, '');
}

const overlayOpen = () => OVERLAYS.some((s) => !s.hidden);

function openReference() {
  if (!dom.referenceViews.children.length) buildReference();
  openOverlay(dom.reference);
}

// ---- Winding, the reward

function enterWinding() {
  stopTimer();
  showPanel('wind');
  dom.windFill.style.width = `${(windClicks / WIND_CLICKS) * 100}%`;
  if (scene.facing() !== 'dial') scene.turnTo('dial');
}

function attachWinding() {
  let last = null;
  let carried = 0;
  let offset = 0;
  dom.windStrip.addEventListener('pointerdown', (e) => {
    sound.unlock();
    dom.windStrip.setPointerCapture(e.pointerId);
    last = e.clientX;
  });
  dom.windStrip.addEventListener('pointermove', (e) => {
    if (last === null) return;
    const dx = e.clientX - last;
    last = e.clientX;
    offset += dx;
    dom.windStrip.style.setProperty('--wind-x', `${offset}px`);
    carried += Math.abs(dx);
    while (carried >= WIND_PX_PER_CLICK) {
      carried -= WIND_PX_PER_CLICK;
      addWindClick();
    }
  });
  const stop = () => {
    last = null;
  };
  dom.windStrip.addEventListener('pointerup', stop);
  dom.windStrip.addEventListener('pointercancel', stop);
}

function addWindClick() {
  if (!game || game.wound) return;
  windClicks += 1;
  sound.ratchet();
  buzz(6);
  dom.windFill.style.width = `${Math.min(100, (windClicks / WIND_CLICKS) * 100)}%`;
  if (windClicks >= WIND_CLICKS) finishWatch();
}

function finishWatch() {
  game.wound = true;
  const stars = grade(game);
  const records = store.read(RECORDS_KEY) ?? {};
  const best = records[game.level];
  if (!best || stars > best.stars || (stars === best.stars && game.elapsedMs < best.ms)) {
    records[game.level] = { stars, ms: game.elapsedMs };
    store.write(RECORDS_KEY, records);
  }
  save();
  enterAdmire({ sweep: true });

  renderResult();
  // Time to watch the hands sweep to the hour before the result covers them.
  setTimeout(() => {
    if (game?.wound) show(dom.result);
  }, 2600);
}

function renderResult() {
  const stars = grade(game);
  $('result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars);
  $('result-grade').textContent = gradeLabel(stars);
  $('result-stats').textContent = t('resultStats', {
    time: formatTime(game.elapsedMs),
    mistakes: game.mistakes,
    hints: game.hints,
  });
}

function renderBackButton() {
  dom.btnBack.textContent = t(scene.backOpen ? 'closeBack' : 'openBack');
}

function enterAdmire({ sweep }) {
  stopTimer();
  showPanel('admire');
  renderProgress();
  dom.timer.textContent = formatTime(game.elapsedMs);
  scene.onBeat = () => sound.tick();
  scene.startRunning({ sweep });
  scene.turnTo('dial');
  renderBackButton();
}

// ---- Language

/** Puts the current language on everything already on screen, without disturbing play. */
function renderLanguage() {
  const code = getLanguage();
  document.documentElement.lang = code;
  document.title = t('appTitle');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  $('app-version').textContent = t('version', { version: VERSION });
  dom.btnLang.textContent = LANGUAGES[code].short;
  for (const b of dom.menuLang.children) b.setAttribute('aria-pressed', b.dataset.lang === code);
}

function changeLanguage(code) {
  setLanguage(code);
  store.write(LANGUAGE_KEY, getLanguage());
  hideToast(); // it was written in the old language
  renderLanguage();
  if (!game) {
    fillMenu();
    return;
  }
  setInfo(infoPart);
  renderProgress();
  renderTray();
  renderResult();
  renderBackButton();
  syncBenchHeight();
}

function buildLanguageMenu() {
  for (const [code, { label }] of Object.entries(LANGUAGES)) {
    const button = document.createElement('button');
    button.className = 'lang-btn';
    button.lang = code;
    button.dataset.lang = code;
    button.textContent = label;
    button.addEventListener('click', () => changeLanguage(code));
    dom.menuLang.append(button);
  }
}

// ---- Wiring

function wire() {
  attachStageGestures(dom.stage, {
    onTap: onStageTap,
    onOrbit: (dx, dy) => scene.orbit(dx, dy),
    onPinch: (factor) => scene.zoomBy(factor),
    onPan: (dx, dy) => scene.panBy(dx, dy),
  });
  attachWinding();

  $('btn-menu').addEventListener('click', () => history.back());
  dom.btnFlip.addEventListener('click', () => {
    dom.btnFlip.classList.remove('nudge');
    scene.flip();
  });
  dom.btnTool.addEventListener('click', onToolButton);
  $('btn-hint').addEventListener('click', onHint);
  $('btn-view').addEventListener('click', () => openOverlay(dom.viewPanel));
  $('btn-view-reset').addEventListener('click', () => {
    scene.resetView();
    history.back();
  });
  $('btn-reference').addEventListener('click', openReference);
  for (const button of document.querySelectorAll('.close-overlay')) {
    button.addEventListener('click', () => history.back());
  }

  $('btn-admire-flip').addEventListener('click', () => scene.flip());
  dom.btnBack.addEventListener('click', () => {
    const open = !scene.backOpen;
    scene.setBackOpen(open);
    renderBackButton();
    if (open) scene.turnTo('train');
  });
  $('btn-admire-menu').addEventListener('click', () => history.back());
  $('btn-result-admire').addEventListener('click', () => show(null));
  $('btn-result-menu').addEventListener('click', () => history.back());

  dom.btnLang.addEventListener('click', () => {
    const codes = Object.keys(LANGUAGES);
    changeLanguage(codes[(codes.indexOf(getLanguage()) + 1) % codes.length]);
  });

  dom.btnSound.textContent = sound.enabled ? '🔊' : '🔇';
  dom.btnSound.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    store.write(SOUND_KEY, sound.enabled);
    dom.btnSound.textContent = sound.enabled ? '🔊' : '🔇';
    sound.unlock();
  });

  // The phone's Back button leaves the game for the menu, not the whole app.
  window.addEventListener('popstate', () => {
    if (overlayOpen()) {
      show(null);
      startTimer();
    } else if (game) {
      save();
      renderMenu();
    }
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (!game || !timerHandle) return;
    if (document.hidden) {
      syncElapsed();
      save();
    } else {
      timerFrom = performance.now() - game.elapsedMs;
    }
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', syncBenchHeight);

  // Graphics memory can be reclaimed behind our back. Progress is saved: start afresh.
  dom.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    save();
  });
  dom.canvas.addEventListener('webglcontextrestored', () => location.reload());
}

function boot() {
  setLanguage(store.read(LANGUAGE_KEY));
  buildLanguageMenu();
  renderLanguage();
  try {
    scene = new WatchScene(dom.canvas);
  } catch (error) {
    console.error(error);
    $('splash-text').textContent = t('noWebgl');
    return;
  }
  // One picture per kind: interchangeable parts share theirs.
  const firstOfKind = new Map();
  for (const p of PARTS) if (!firstOfKind.has(p.kind)) firstOfKind.set(p.kind, p.id);
  const pictures = scene.thumbnails([...firstOfKind.values()]);
  thumbs = new Map([...firstOfKind].map(([kind, id]) => [kind, pictures.get(id)]));
  renderBackView();
  wire();
  // A reload mid-game lands on the game's history entry: leave it, so Back still works.
  if (history.state?.game) history.go(history.state.overlay ? -2 : -1);
  renderMenu();
  dom.splash.hidden = true;

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Offline mode unavailable', error));
  }
}

boot();
