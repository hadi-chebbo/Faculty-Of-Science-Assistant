// Quotes, slashes, control characters and line breaks are dropped so a Content-Disposition
// header cannot be broken. Shared by the local route and the R2 driver.
export function safeFilename(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[\u0000-\u001f\u007f"\\/;]/g, "").trim().slice(0, 150);
  return cleaned || "file.pdf";
}
