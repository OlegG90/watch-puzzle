// Touch handling for the watch: one finger turns it, two pinch and pan, and a
// still touch is a tap. A tap and a turn can never be confused, however shaky the
// hand, because only movement past TAP_SLOP counts as turning. A touch held still
// can start aiming, if onHoldStart accepts it; otherwise it is still a tap.

const TAP_SLOP = 10; // px
const HOLD_MS = 280;

/**
 * @param {HTMLElement} el
 * @param {{onTap(x,y), onOrbit(dx,dy), onPinch(factor), onPan(dx,dy),
 *   onHoldStart(x,y): boolean, onAim(x,y), onAimEnd(x,y,cancelled)}} handlers
 *   coordinates are relative to the element
 */
export function attachStageGestures(el, handlers) {
  const pointers = new Map();
  let gesture = null; // 'maybe-tap' | 'orbit' | 'pinch' | 'aim'
  let holdTimer = null;
  let startX = 0;
  let startY = 0;
  let lastSpread = 0;
  let lastMid = null;

  const local = (e) => {
    const box = el.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const midpoint = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    clearTimeout(holdTimer);
    if (pointers.size === 1) {
      gesture = 'maybe-tap';
      ({ x: startX, y: startY } = local(e));
      holdTimer = setTimeout(() => {
        if (gesture === 'maybe-tap' && handlers.onHoldStart(startX, startY)) gesture = 'aim';
      }, HOLD_MS);
    } else {
      if (gesture === 'aim') handlers.onAimEnd(startX, startY, true);
      gesture = 'pinch';
      lastSpread = spread();
      lastMid = midpoint();
    }
  });

  el.addEventListener('pointermove', (e) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const now = local(e);
    pointers.set(e.pointerId, now);
    if (gesture === 'maybe-tap' && Math.hypot(now.x - startX, now.y - startY) > TAP_SLOP) {
      clearTimeout(holdTimer);
      gesture = 'orbit';
    }
    if (gesture === 'aim') {
      handlers.onAim(now.x, now.y);
    } else if (gesture === 'orbit') {
      handlers.onOrbit(now.x - previous.x, now.y - previous.y);
    } else if (gesture === 'pinch') {
      const s = spread();
      const m = midpoint();
      if (lastSpread > 0) handlers.onPinch(s / lastSpread);
      handlers.onPan(m.x - lastMid.x, m.y - lastMid.y);
      lastSpread = s;
      lastMid = m;
    }
  });

  const release = (e, cancelled) => {
    if (!pointers.has(e.pointerId)) return;
    const at = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (gesture === 'aim') handlers.onAimEnd(at.x, at.y, cancelled);
    if (gesture === 'maybe-tap' && !cancelled && pointers.size === 0) {
      handlers.onTap(at.x, at.y);
    }
    // Lifting one finger of a pinch must not turn into a sudden orbit.
    if (pointers.size < 2) gesture = null;
    else {
      // Still pinching, with a different pair: measure afresh, or the view jumps.
      lastSpread = spread();
      lastMid = midpoint();
    }
  };
  el.addEventListener('pointerup', (e) => release(e, false));
  el.addEventListener('pointercancel', (e) => release(e, true));

  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      handlers.onPinch(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );
}
