// Touch handling for the watch: one finger turns it, two pinch and pan, and a
// quick still touch is a tap. A tap and a turn can never be confused, however
// shaky the hand, because only movement past TAP_SLOP counts as turning.

const TAP_SLOP = 10; // px

/**
 * @param {HTMLElement} el
 * @param {{onTap(x,y), onOrbit(dx,dy), onPinch(factor), onPan(dx,dy)}} handlers
 *   coordinates are relative to the element
 */
export function attachStageGestures(el, handlers) {
  const pointers = new Map();
  let gesture = null; // 'maybe-tap' | 'orbit' | 'pinch'
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
    if (pointers.size === 1) {
      gesture = 'maybe-tap';
      ({ x: startX, y: startY } = local(e));
    } else {
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
      gesture = 'orbit';
    }
    if (gesture === 'orbit') {
      handlers.onOrbit(now.x - previous.x, now.y - previous.y);
    } else if (gesture === 'pinch' && pointers.size >= 2) {
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
    if (gesture === 'maybe-tap' && !cancelled && pointers.size === 0) {
      handlers.onTap(at.x, at.y);
    }
    // Lifting one finger of a pinch must not turn into a sudden orbit.
    if (pointers.size === 0) gesture = null;
    else if (pointers.size === 1) gesture = 'settling';
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
