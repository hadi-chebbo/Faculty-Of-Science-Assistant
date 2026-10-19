// Pure helpers for the phone reader: what counts as a tap on the reading area, and the timer that
// hides the floating bar by itself. The component wires them to pointer events and to React.

// A tap is a press and release this close together in time and place; anything slower is a
// long-press, anything that moved further is a scroll, a swipe or a text selection.
export const TAP_MAX_MS = 300;
export const TAP_MAX_MOVE_PX = 10;

// How long the bar stays after it appeared when the page loads, and after it was last used.
export const INITIAL_SHOW_MS = 3000;
export const AUTO_HIDE_MS = 4000;
// When the bar is held open at the moment its timer fires, look again after this long.
export const HOLD_RECHECK_MS = 500;

export interface PointerPoint {
  x: number;
  y: number;
  // Milliseconds, from any clock as long as down and up use the same one.
  time: number;
}

export function isTap(down: PointerPoint, up: PointerPoint): boolean {
  const duration = up.time - down.time;
  return duration >= 0 && duration <= TAP_MAX_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE_PX;
}

export interface TapTracker {
  down(id: number, point: PointerPoint): void;
  move(id: number, point: PointerPoint): void;
  // True when this release ends a tap.
  up(id: number, point: PointerPoint): boolean;
  cancel(id: number): void;
}

// Follows pointers over the reading area. A second finger, even briefly (a pinch), spoils the
// gesture until every finger is up; the browser's own cancel (it takes over for a scroll) does too.
export function createTapTracker(): TapTracker {
  const pressed = new Map<number, PointerPoint>();
  let spoiled = false;
  const forget = (id: number) => {
    pressed.delete(id);
    if (pressed.size === 0) spoiled = false;
  };
  return {
    down(id, point) {
      if (pressed.size > 0) spoiled = true;
      pressed.set(id, point);
    },
    move(id, point) {
      const start = pressed.get(id);
      if (start && Math.hypot(point.x - start.x, point.y - start.y) > TAP_MAX_MOVE_PX) spoiled = true;
    },
    up(id, point) {
      const start = pressed.get(id);
      const ok = !spoiled && start !== undefined && pressed.size === 1 && isTap(start, point);
      forget(id);
      return ok;
    },
    cancel(id) {
      if (pressed.has(id)) spoiled = true;
      forget(id);
    },
  };
}

export interface HideTimer {
  // (Re)starts the countdown; any earlier one is dropped.
  arm(ms: number): void;
  cancel(): void;
}

// Calls onHide once the countdown ends, unless something holds the bar open (the page-number box
// is focused, a menu is open, a scroll to a page is still moving): then it looks again shortly.
export function createHideTimer(isHeld: () => boolean, onHide: () => void): HideTimer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function arm(ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (isHeld()) arm(HOLD_RECHECK_MS);
      else onHide();
    }, ms);
  }
  return { arm, cancel: () => clearTimeout(timer) };
}
