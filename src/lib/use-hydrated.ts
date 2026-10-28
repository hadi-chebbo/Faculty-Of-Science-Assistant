import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False on the server and during hydration, true afterwards. Forms use it to keep their
// submit button disabled until React is attached, so a native submit can never slip through.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
