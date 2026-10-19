"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_HIDE_MS, createHideTimer, INITIAL_SHOW_MS, type HideTimer } from "./reader-tap";

// Whether the reader's floating bar is showing. While enabled it shows for a few seconds when it
// starts, then hides itself a while after it was shown or last used (poke). When not enabled the
// bar is simply always there and nothing is running.
export function useAutoHide(enabled: boolean, isHeld: () => boolean) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(true);
  const timerRef = useRef<HideTimer | null>(null);
  const heldRef = useRef(isHeld);
  useEffect(() => {
    heldRef.current = isHeld;
  });

  const set = useCallback((value: boolean) => {
    shownRef.current = value;
    setShown(value);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = createHideTimer(
      () => heldRef.current(),
      () => set(false),
    );
    timerRef.current = timer;
    timer.arm(INITIAL_SHOW_MS);
    return () => {
      timer.cancel();
      timerRef.current = null;
      set(true);
    };
  }, [enabled, set]);

  const show = useCallback(() => {
    set(true);
    timerRef.current?.arm(AUTO_HIDE_MS);
  }, [set]);

  // The bar was used: keep it for another while. Does nothing while it is hidden.
  const poke = useCallback(() => {
    if (shownRef.current) timerRef.current?.arm(AUTO_HIDE_MS);
  }, []);

  const toggle = useCallback(() => {
    if (shownRef.current) {
      timerRef.current?.cancel();
      set(false);
    } else {
      show();
    }
  }, [set, show]);

  return { shown: enabled ? shown : true, show, poke, toggle };
}
