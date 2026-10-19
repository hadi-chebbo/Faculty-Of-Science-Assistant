// Quotes, slashes, control characters and line breaks are dropped so a Content-Disposition
// header cannot be broken. Shared by the local route and the R2 driver.
export function safeFilename(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[\u0000-\u001f\u007f"\\/;]/g, "").trim().slice(0, 150);
  return cleaned || "file.pdf";
}

// A Content-Disposition value for a download (RFC 6266). Headers can only carry ASCII, so the name
// goes twice: an ASCII fallback (accents dropped, anything else "_") for old clients, and the exact
// UTF-8 name percent-encoded in filename*, which browsers prefer. "Examen l’été.pdf" would otherwise
// break the header (a Response refuses it) or arrive garbled.
export function attachmentDisposition(name: string | undefined): string {
  const safe = safeFilename(name);
  const ascii = safe.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_");
  // encodeURIComponent leaves ' ( ) * as they are; RFC 5987 needs them encoded too.
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
