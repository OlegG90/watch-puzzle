// Tells a scroller with a hidden scrollbar which of its edges have more beyond them.
// Works on either axis, since only the one the element scrolls along ever has an offset.

const SLOP = 10; // px: the scroller's own padding is not more content, and offsets can be fractional

/** Whether there is more content before and after the visible part of the scroller. */
export function scrollEdges(el) {
  return {
    before: el.scrollLeft > SLOP || el.scrollTop > SLOP,
    after:
      el.scrollWidth - el.clientWidth - el.scrollLeft > SLOP
      || el.scrollHeight - el.clientHeight - el.scrollTop > SLOP,
  };
}

/** Keeps the classes more-before and more-after up to date; returns a function to update by hand. */
export function attachScrollHint(el) {
  const update = () => {
    const { before, after } = scrollEdges(el);
    el.classList.toggle('more-before', before);
    el.classList.toggle('more-after', after);
  };
  el.addEventListener('scroll', update, { passive: true });
  // Also covers turning the phone and the tray coming back from being hidden.
  new ResizeObserver(update).observe(el);
  return update;
}
