// The sign-in dialog a signed-out visitor gets when they tap Save, Add to to-do or Mark as done.
// A tiny module store: `requestSignIn` opens the one dialog host mounted in SiteChrome and resolves
// to true once the visitor signed in (the caller then does the action), or false when the dialog
// was dismissed (Not now, Esc, backdrop) and nothing should happen.

export type SignInAction = "save" | "add-to-todo" | "mark-done";

export const SIGN_IN_ACTION_TEXT: Record<SignInAction, { title: string; submit: string }> = {
  save: { title: "Sign in to save this file", submit: "Sign in and save" },
  "add-to-todo": { title: "Sign in to add this file to your to-do", submit: "Sign in and add" },
  "mark-done": { title: "Sign in to mark this file as done", submit: "Sign in and mark as done" },
};

export interface SignInRequest {
  action: SignInAction;
  // Where focus returns when the dialog closes without signing in (the tapped control).
  returnFocus: HTMLElement | null;
  resolve: (signedIn: boolean) => void;
}

type Listener = () => void;

let current: SignInRequest | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const signInDialog = {
  get: (): SignInRequest | null => current,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  // Closes the dialog and settles the pending request.
  finish(signedIn: boolean): void {
    const request = current;
    if (!request) return;
    current = null;
    emit();
    request.resolve(signedIn);
  },
};

// Opens the dialog. A second request while one is open settles the first as dismissed.
export function requestSignIn(action: SignInAction): Promise<boolean> {
  signInDialog.finish(false);
  const returnFocus = typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);
  return new Promise<boolean>((resolve) => {
    current = { action, returnFocus, resolve };
    emit();
  });
}
