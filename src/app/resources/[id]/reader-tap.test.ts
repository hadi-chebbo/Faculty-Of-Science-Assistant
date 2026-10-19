import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_HIDE_MS, createHideTimer, createTapTracker, HOLD_RECHECK_MS, isTap, TAP_MAX_MOVE_PX, TAP_MAX_MS } from "./reader-tap";

const at = (x: number, y: number, time: number) => ({ x, y, time });

describe("isTap", () => {
  it("accepts a quick press that stayed put", () => {
    expect(isTap(at(10, 10, 0), at(10, 10, 80))).toBe(true);
    expect(isTap(at(10, 10, 0), at(13, 14, TAP_MAX_MS))).toBe(true);
  });

  it("rejects a press that lasted too long (long-press, selection)", () => {
    expect(isTap(at(10, 10, 0), at(10, 10, TAP_MAX_MS + 1))).toBe(false);
  });

  it("rejects a press that moved too far (scroll, swipe)", () => {
    expect(isTap(at(0, 0, 0), at(0, TAP_MAX_MOVE_PX + 1, 50))).toBe(false);
    expect(isTap(at(0, 0, 0), at(8, 8, 50))).toBe(false);
  });

  it("rejects a release that is earlier than the press", () => {
    expect(isTap(at(0, 0, 100), at(0, 0, 50))).toBe(false);
  });
});

describe("createTapTracker", () => {
  it("reports a single quick tap", () => {
    const tracker = createTapTracker();
    tracker.down(1, at(5, 5, 0));
    expect(tracker.up(1, at(5, 6, 100))).toBe(true);
  });

  it("does not report a release it never saw the press of", () => {
    expect(createTapTracker().up(1, at(0, 0, 10))).toBe(false);
  });

  it("rejects a second finger, even if the first one then taps cleanly", () => {
    const tracker = createTapTracker();
    tracker.down(1, at(5, 5, 0));
    tracker.down(2, at(50, 50, 20));
    expect(tracker.up(2, at(50, 50, 60))).toBe(false);
    expect(tracker.up(1, at(5, 5, 90))).toBe(false);
    // The next touch starts clean.
    tracker.down(3, at(5, 5, 1000));
    expect(tracker.up(3, at(5, 5, 1050))).toBe(true);
  });

  it("rejects a pointer that moved past the limit and came back", () => {
    const tracker = createTapTracker();
    tracker.down(1, at(0, 0, 0));
    tracker.move(1, at(0, 40, 30));
    expect(tracker.up(1, at(0, 0, 60))).toBe(false);
  });

  it("rejects a gesture the browser cancelled", () => {
    const tracker = createTapTracker();
    tracker.down(1, at(0, 0, 0));
    tracker.cancel(1);
    expect(tracker.up(1, at(0, 0, 40))).toBe(false);
    tracker.down(2, at(0, 0, 100));
    expect(tracker.up(2, at(0, 0, 140))).toBe(true);
  });

  it("rejects a slow press", () => {
    const tracker = createTapTracker();
    tracker.down(1, at(0, 0, 0));
    expect(tracker.up(1, at(0, 0, 900))).toBe(false);
  });
});

describe("createHideTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hides when the time is up", () => {
    const onHide = vi.fn();
    createHideTimer(() => false, onHide).arm(AUTO_HIDE_MS);
    vi.advanceTimersByTime(AUTO_HIDE_MS - 1);
    expect(onHide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("starts over when armed again (an interaction)", () => {
    const onHide = vi.fn();
    const timer = createHideTimer(() => false, onHide);
    timer.arm(AUTO_HIDE_MS);
    vi.advanceTimersByTime(AUTO_HIDE_MS - 100);
    timer.arm(AUTO_HIDE_MS);
    vi.advanceTimersByTime(AUTO_HIDE_MS - 100);
    expect(onHide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("does not hide while held, and hides soon after the hold ends", () => {
    let held = true;
    const onHide = vi.fn();
    createHideTimer(() => held, onHide).arm(AUTO_HIDE_MS);
    vi.advanceTimersByTime(AUTO_HIDE_MS + 10 * HOLD_RECHECK_MS);
    expect(onHide).not.toHaveBeenCalled();
    held = false;
    vi.advanceTimersByTime(HOLD_RECHECK_MS);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("does nothing once cancelled", () => {
    const onHide = vi.fn();
    const timer = createHideTimer(() => false, onHide);
    timer.arm(AUTO_HIDE_MS);
    timer.cancel();
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2);
    expect(onHide).not.toHaveBeenCalled();
  });
});
