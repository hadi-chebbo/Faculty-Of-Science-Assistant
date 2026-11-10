// A lecturer's name as written, e.g. "Dr. Ali Ghorayeb". A leading title (Dr. / Pr. / Prof., with or
// without the dot) is left out of the slug and of the initials; this is the one place that rule lives.
const LEADING_TITLE = /^(?:dr|pr|prof)\.?\s+/i;

export function withoutLecturerTitle(name: string): string {
  return name.replace(LEADING_TITLE, "");
}

// "Dr. Ada Example" -> "AE": the first and last word after the title give the letters.
export function lecturerInitials(name: string): string {
  const words = withoutLecturerTitle(name.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((w) => Array.from(w)[0].toUpperCase()).join("");
}
