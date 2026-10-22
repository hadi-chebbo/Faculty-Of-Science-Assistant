// sessionStorage key holding the address just signed up, so the next page can show it masked.
// Never put the address in a URL.
export const SIGNUP_EMAIL_KEY = "signup:email";

export function clearSignupEmail(): void {
  try {
    sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}
