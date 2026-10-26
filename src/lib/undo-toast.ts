import { toast } from "sonner";

// How long the Undo message stays on screen.
export const UNDO_TOAST_MS = 5000;

// A message with an "Undo" button, used after a card is deleted (and, later, moved). The button is
// a real <button> inside sonner's live region, so keyboard and screen-reader users can reach it
// (Tab, or Alt+T to jump to the notifications). Returns the toast id.
export function showUndoToast(message: string, onUndo: () => void): string | number {
  return toast(message, { action: { label: "Undo", onClick: onUndo }, duration: UNDO_TOAST_MS });
}
