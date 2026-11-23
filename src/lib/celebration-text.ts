// Wording of the finish celebrations, kept pure so the singular and plural can be tested.

// "all 5 files", and "the only file" for a course with one counted file.
export function allFiles(total: number): string {
  return total === 1 ? "the only file" : `all ${total} files`;
}

// The chapter-finished toast's description: "Layouts, all 5 files done." / "Layouts, 1 file done."
export function chapterFinishedDescription(title: string, total: number): string {
  return `${title}, ${total === 1 ? "1 file" : `all ${total} files`} done.`;
}
