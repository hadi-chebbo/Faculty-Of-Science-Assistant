// Browser-side session helpers, shared by the header account control and the save controls.
// Public pages are static, so the browser asks who is signed in after the page has loaded.

export type Account = { name: string | null; role: "student" | "admin" };

// Callers that ask at the same moment (the header and the progress stores on a page load) share one
// request; once it has answered, the next call asks again.
let askingMe: Promise<{ user: Account | null; renewable: boolean }> | null = null;

export function askMe(): Promise<{ user: Account | null; renewable: boolean }> {
  if (!askingMe) {
    askingMe = (async () => {
      const response = await fetch("/api/v1/auth/me", { cache: "no-store" });
      if (!response.ok) return { user: null, renewable: false };
      return (await response.json()) as { user: Account | null; renewable: boolean };
    })().finally(() => {
      askingMe = null;
    });
  }
  return askingMe;
}

// Renews the session, one caller at a time across every tab of this browser. A refresh token works
// once and a second use signs the whole session out, so tabs that load together must not all
// present the same one: each waits for the lock and first checks whether another already renewed.
export async function renew(): Promise<Account | null> {
  const work = async () => {
    const again = await askMe();
    if (again.user || !again.renewable) return again.user;
    const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST" });
    return refreshed.ok ? (await askMe()).user : null;
  };
  // Browsers without the Web Locks API renew unguarded.
  return navigator.locks ? navigator.locks.request("ua-session-refresh", work) : work();
}

// Admin pages renew an expired session themselves (through /api/v1/auth/restore, while the account
// control is already on screen), so there the browser must not rotate the same refresh token.
export async function findAccount(mayRefresh: boolean): Promise<Account | null> {
  try {
    const first = await askMe();
    if (first.user || !first.renewable || !mayRefresh) return first.user;
    return await renew();
  } catch {
    return null;
  }
}
