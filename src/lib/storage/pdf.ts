const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

// True when the bytes begin like a PDF. A cheap check on what was actually uploaded.
export function looksLikePdf(start: Uint8Array): boolean {
  return start.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, i) => start[i] === byte);
}
