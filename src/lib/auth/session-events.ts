// Fired on `window` after the browser signs in or out, so the header account control asks again.
export const SESSION_CHANGED_EVENT = "ua:session-changed";

export function announceSessionChange(): void {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}
