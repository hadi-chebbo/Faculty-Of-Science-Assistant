// Browser-side fetch for admin actions. The access token lasts 15 minutes; on a 401 this renews the
// session once through the refresh route and retries the request once. If the session cannot be
// renewed, `onSignedOut` runs (the caller sends the browser to /sign-in) and the 401 is returned.
export async function adminFetch(url: string, init: RequestInit, onSignedOut: () => void): Promise<Response> {
  let response = await fetch(url, init);
  if (response.status !== 401) return response;

  const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST" });
  if (refreshed.ok) response = await fetch(url, init);

  if (response.status === 401) onSignedOut();
  return response;
}
