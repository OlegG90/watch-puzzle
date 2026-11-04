// The game screen: connects the rules (Game), the stage (WatchScene) and the DOM.

import { LEVELS, PARTS } from './game/parts.js';
import { Game, TOOLS, grade } from './game/state.js';
import { WatchScene } from './render/scene.js';
import { Sound, buzz } from './ui/audio.js';
import { attachStageGestures } from './ui/gestures.js';

const SAVE_KEY = 'godynnykar.save.v1';
const RECORDS_KEY = 'godynnykar.records.v1';
const SOUND_KEY = 'godynnykar.sound.v1';
const WIND_CLICKS = 24;
const WIND_PX_PER_CLICK = 16;
const DRAG_START_PX = 8;
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
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // As above.
    }
  },
};

const sound = new Sound(store.read(SOUND_KEY) !== false);

let scene;
let thumbs;
let game = null;
let selectedKind = null;
let timerHandle = null;
let timerFrom = 0;
let toastHandle = null;
let windClicks = 0;

// ---- Screens

function show(screen) {
  for (const s of [dom.menu, dom.result]) s.hidden = s !== screen;
}

function setPlaying(playing) {
  document.body.classList.toggle('playing', playing);
  dom.hud.hidden = !playing;
  dom.bench.hidden = !playing;
  syncBenchHeight();
}

function syncBenchHeight() {
  const h = dom.bench.hidden ? 0 : dom.bench.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--bench-h', `${h}px`);
}

function renderMenu() {
  scene.clear();
  game = null;
  setPlaying(false);
  dom.tools.hidden = true;
  stopTimer();
  dom.menuButtons.replaceChildren();
  const records = store.read(RECORDS_KEY) ?? {};
  const saved = store.read(SAVE_KEY);
  if (saved?.level && LEVELS[saved.level]) {
    const g = new Game(saved.level, saved);
    dom.menuButtons.append(
      menuButton('Продовжити', `${LEVELS[saved.level].name}: ${g.placed} із ${g.total} деталей`, () => startGame(saved.level, saved)),
    );
  }
  for (const level of Object.values(LEVELS)) {
    const best = records[level.id];
    const bestText = best ? ` · найкраще ${'★'.repeat(best.stars)} ${formatTime(best.ms)}` : '';
    const button = menuButton(
      `${level.name}: нове збирання`,
      `${level.note}${bestText}`,
      () => startGame(level.id),
    );
    if (saved) button.classList.add('ghost');
    dom.menuButtons.append(button);
  }
  show(dom.menu);
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
  if (!saved && existing?.installed?.length && !existing.wound && !confirm('Почати заново? Поточне збирання буде втрачено.')) return;
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
  dom.tools.hidden = false;
  startTimer();
  refresh();
  setInfo(null);
}

function save() {
  if (game) store.write(SAVE_KEY, game);
}

function startTimer() {
  stopTimer();
  timerFrom = performance.now() - game.elapsedMs;
  timerHandle = setInterval(() => {
    if (document.hidden) return;
    game.elapsedMs = performance.now() - timerFrom;
    dom.timer.textContent = formatTime(game.elapsedMs);
  }, 1000);
  dom.timer.textContent = formatTime(game.elapsedMs);
}

function stopTimer() {
  if (timerHandle !== null) clearInterval(timerHandle);
  timerHandle = null;
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---- The bench

function refresh() {
  dom.progressText.textContent = `${LEVELS[game.level].name} · ${game.placed} із ${game.total}`;
  dom.progressFill.style.width = `${(game.placed / game.total) * 100}%`;

  const loose = game.looseScrews().length;
  dom.looseBadge.hidden = loose === 0;
  dom.looseBadge.textContent = loose;
  dom.btnTool.classList.toggle('active', game.tool === TOOLS.SCREWDRIVER);
  dom.btnTool.classList.toggle('nudge', loose > 0 && game.tool !== TOOLS.SCREWDRIVER);
  if (loose === 0 && game.tool === TOOLS.SCREWDRIVER) setTool(TOOLS.TWEEZERS);

  renderTray();

  if (game.assembled) enterWinding();
  else {
    dom.wind.hidden = true;
    dom.admire.hidden = true;
    dom.tray.hidden = false;
    dom.info.hidden = false;
  }
  syncBenchHeight();
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
    return card;
  });
  // Touching a card's neighbours would lose an active drag or the scroll position.
  const same = cards.length === dom.tray.children.length && cards.every((c, i) => c === dom.tray.children[i]);
  if (!same) dom.tray.replaceChildren(...cards);
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
  name.textContent = stack.part.name;
  const badge = document.createElement('b');
  card.append(img, name, badge);
  attachCardGestures(card, stack.kind);
  return card;
}

/** A tap selects; a pull out of the tray picks the part up with the finger. */
function attachCardGestures(card, kind) {
  card.addEventListener('pointerdown', (e) => {
    sound.unlock();
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > DRAG_START_PX) {
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (dragging) finishDrag(kind, ev, cancelled, card);
      // A cancel without a drag means the browser took the touch to scroll the tray.
      else if (!cancelled) toggleSelect(kind);
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

function toggleSelect(kind) {
  selectedKind = selectedKind === kind ? null : kind;
  setTool(TOOLS.TWEEZERS);
  clearPointed();
  renderTray();
  setInfo(selectedKind ? game.openSlots(kind)[0] : null);
}

function setInfo(part) {
  if (part) {
    dom.infoTitle.textContent = part.name;
    dom.infoText.textContent = part.desc;
  } else {
    dom.infoTitle.textContent = 'Оберіть деталь';
    dom.infoText.textContent = 'Торкніться деталі й місця на механізмі або потягніть її вгору. Палець обертає годинник, два пальці наближають.';
  }
}

function setTool(tool) {
  game.tool = tool;
  dom.btnTool.classList.toggle('active', tool === TOOLS.SCREWDRIVER);
}

function clearPointed() {
  for (const c of dom.tray.querySelectorAll('.pointed')) c.classList.remove('pointed');
}

// ---- Toasts

function toast(message, bad = false) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('bad', bad);
  dom.toast.hidden = false;
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => {
    dom.toast.hidden = true;
  }, bad ? 3600 : 2400);
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
  clearPointed();
  renderTray();
  card.classList.add('lifted');
  const slots = game.openSlots(kind);
  setInfo(slots[0]);
  scene.startDrag(slots[0]);
}

function updateDrag(kind, ev) {
  const p = dragPoint(ev);
  scene.moveDrag(p.x, p.y, scene.nearest(game.openSlots(kind), p.x, p.y));
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

function attemptPlace(kind, x, y) {
  const slots = game.openSlots(kind);
  const slot = scene.nearest(slots, x, y);
  if (slot) {
    const result = game.place(slot.id);
    if (result.ok) onPlaced(slot, result.auto);
    else onRefused(result);
    return;
  }
  // Every slot is on the other face: the player's aim may be right, so no penalty.
  const side = scene.facing();
  if (slots.every((s) => s.side !== 'any' && s.side !== side)) {
    toast('Ця деталь встановлюється з іншого боку. Переверніть механізм.');
    dom.btnFlip.classList.add('nudge');
    sound.wrong();
    return;
  }
  game.miss();
  toast(`${slots[0].name} стоїть не тут. Придивіться, куди вона підійде.`, true);
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
    toast('Гвинт стоїть, але ще не затягнутий. Візьміть викрутку й торкніться його.');
  }
  refresh();
}

function onRefused(result) {
  sound.wrong();
  buzz(30);
  if (result.reason === 'loose') {
    toast('Спершу затягніть усі гвинти: потім до них не дістатись.', true);
    dom.btnTool.classList.add('nudge');
  } else {
    const names = result.missing.slice(0, 2).map((p) => p.name).join(', ');
    toast(`Спершу потрібно встановити: ${names}.`, true);
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
      toast('Торкніться незатягнутого гвинта. Він трохи стирчить над мостом.');
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
  const part = scene.nearest(PARTS.filter((p) => game.isInstalled(p.id)), x, y);
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
    toast('Зараз немає гвинтів, які треба затягнути.');
    return;
  }
  setTool(TOOLS.SCREWDRIVER);
  selectedKind = null;
  renderTray();
  // A loose screw on the far face would be unreachable, so turn the watch round.
  const reachable = game.looseScrews().some((p) => p.side === scene.facing());
  if (!reachable) scene.turnTo(game.looseScrews()[0].side);
  toast('Торкніться гвинта, щоб затягнути його.');
}

function onHint() {
  sound.unlock();
  const suggestion = game.suggest(selectedKind);
  if (!suggestion) return;
  game.hints += 1;
  const { type, part } = suggestion;
  if (part.side !== 'any' && part.side !== scene.facing()) scene.turnTo(part.side);
  if (type === 'tighten') {
    setTool(TOOLS.SCREWDRIVER);
    toast(`Затягніть цей гвинт: ${part.name.toLowerCase()}.`);
  } else {
    if (selectedKind && selectedKind !== part.kind) {
      toast(`Цю деталь рано ставити. Спершу: ${part.name}.`);
    } else {
      toast(`${part.name} стає сюди.`);
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

// ---- Winding, the reward

function enterWinding() {
  stopTimer();
  dom.tools.hidden = true;
  dom.tray.hidden = true;
  dom.info.hidden = true;
  dom.admire.hidden = true;
  dom.wind.hidden = false;
  dom.windFill.style.width = `${(windClicks / WIND_CLICKS) * 100}%`;
  if (scene.facing() !== 'dial') scene.turnTo('dial');
  syncBenchHeight();
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
  const verdict = grade(game);
  const records = store.read(RECORDS_KEY) ?? {};
  const best = records[game.level];
  if (!best || verdict.stars > best.stars || (verdict.stars === best.stars && game.elapsedMs < best.ms)) {
    records[game.level] = { stars: verdict.stars, ms: game.elapsedMs };
    store.write(RECORDS_KEY, records);
  }
  save();
  enterAdmire({ sweep: true });

  $('result-stars').textContent = '★'.repeat(verdict.stars) + '☆'.repeat(3 - verdict.stars);
  $('result-grade').textContent = verdict.label;
  $('result-stats').textContent = `Час: ${formatTime(game.elapsedMs)} · помилок: ${game.mistakes} · підказок: ${game.hints}`;
  // Time to watch the hands sweep to the hour before the result covers them.
  setTimeout(() => {
    if (game?.wound) show(dom.result);
  }, 2600);
}

function enterAdmire({ sweep }) {
  stopTimer();
  dom.tools.hidden = true;
  dom.tray.hidden = true;
  dom.info.hidden = true;
  dom.wind.hidden = true;
  dom.admire.hidden = false;
  dom.progressText.textContent = LEVELS[game.level].name;
  dom.progressFill.style.width = '100%';
  dom.timer.textContent = formatTime(game.elapsedMs);
  scene.onBeat = () => sound.tick();
  scene.startRunning({ sweep });
  scene.turnTo('dial');
  dom.btnBack.textContent = 'Відкрити кришку';
  syncBenchHeight();
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

  $('btn-menu').addEventListener('click', () => {
    save();
    history.back();
  });
  dom.btnFlip.addEventListener('click', () => {
    dom.btnFlip.classList.remove('nudge');
    scene.flip();
  });
  dom.btnTool.addEventListener('click', onToolButton);
  $('btn-hint').addEventListener('click', onHint);
  $('btn-view').addEventListener('click', () => scene.resetView());

  $('btn-admire-flip').addEventListener('click', () => scene.flip());
  dom.btnBack.addEventListener('click', () => {
    const open = !scene.backOpen;
    scene.setBackOpen(open);
    dom.btnBack.textContent = open ? 'Закрити кришку' : 'Відкрити кришку';
    if (open) scene.turnTo('train');
  });
  $('btn-admire-menu').addEventListener('click', () => history.back());
  $('btn-result-admire').addEventListener('click', () => show(null));
  $('btn-result-menu').addEventListener('click', () => history.back());

  dom.btnSound.textContent = sound.enabled ? '🔊' : '🔇';
  dom.btnSound.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    store.write(SOUND_KEY, sound.enabled);
    dom.btnSound.textContent = sound.enabled ? '🔊' : '🔇';
    sound.unlock();
  });

  // The phone's Back button leaves the game for the menu, not the whole app.
  window.addEventListener('popstate', () => {
    if (game) {
      save();
      show(null);
      renderMenu();
    }
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (!game || !timerHandle) return;
    if (document.hidden) {
      game.elapsedMs = performance.now() - timerFrom;
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
  try {
    scene = new WatchScene(dom.canvas);
  } catch (error) {
    console.error(error);
    $('splash-text').textContent = 'На жаль, цей браузер не підтримує 3D-графіку (WebGL), тому гра не може запуститися.';
    return;
  }
  // One picture per kind: interchangeable parts share theirs.
  const firstOfKind = new Map();
  for (const p of PARTS) if (!firstOfKind.has(p.kind)) firstOfKind.set(p.kind, p.id);
  const pictures = scene.thumbnails([...firstOfKind.values()]);
  thumbs = new Map([...firstOfKind].map(([kind, id]) => [kind, pictures.get(id)]));
  wire();
  renderMenu();
  dom.splash.hidden = true;

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Offline mode unavailable', error));
  }
}

boot();
