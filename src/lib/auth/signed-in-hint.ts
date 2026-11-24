// A readable "this browser probably has a session" hint, set next to the session cookies
// (`setSessionCookies`) and cleared with them. It holds nothing personal and nothing on the server
// reads it: it only lets the browser reserve space for personal content before the session check
// answers. The inline script in the root layout (`SIGNED_IN_SCRIPT`) does the same test as
// `hasSignedInHint`; keep the two in step.
export const SIGNED_IN_HINT_COOKIE = "ua_signed_in";

export function hasSignedInHint(cookieString: string): boolean {
  return cookieString.split(";").some((part) => part.trim() === `${SIGNED_IN_HINT_COOKIE}=1`);
}

export const BAND_HEIGHT_KEY = "home:band-h";
// The attribute on <html> and the CSS variable the pre-paint script sets; globals.css uses the same names.
export const SIGNED_IN_MARKER = "data-signed-in";
export const BAND_HEIGHT_VAR = "--home-band-h";
export const BAND_HEIGHT_MIN = 80;
export const BAND_HEIGHT_MAX = 600;

export function saneBandHeight(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= BAND_HEIGHT_MIN && n <= BAND_HEIGHT_MAX ? n : null;
}

// Runs in <head> before paint. Marks <html> with data-signed-in when the hint is present and sets
// --home-band-h from the stored band height. Plain ES5, no imports, wrapped so a blocked
// localStorage never breaks the page.
export const SIGNED_IN_SCRIPT = `(function(){try{var h=document.documentElement;if(document.cookie.split(";").some(function(p){return p.trim()==="${SIGNED_IN_HINT_COOKIE}=1"})){h.setAttribute("${SIGNED_IN_MARKER}","1");try{var v=localStorage.getItem("${BAND_HEIGHT_KEY}");if(v&&/^\\d+$/.test(v)){var n=+v;if(n>=${BAND_HEIGHT_MIN}&&n<=${BAND_HEIGHT_MAX})h.style.setProperty("${BAND_HEIGHT_VAR}",n+"px")}}catch(e){}}}catch(e){}})()`;
