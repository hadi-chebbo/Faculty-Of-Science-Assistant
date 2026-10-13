// Groups exams (already sorted newest year first) into one block per academic year, keeping their
// order inside a year. Exams with no academic year form a last block with `year: null`.
export function groupExamsByYear<T extends { academicYearStart: number | null }>(
  exams: T[],
): { year: number | null; exams: T[] }[] {
  const groups: { year: number | null; exams: T[] }[] = [];
  for (const exam of exams) {
    const group = groups.find((g) => g.year === exam.academicYearStart);
    if (group) group.exams.push(exam);
    else groups.push({ year: exam.academicYearStart, exams: [exam] });
  }
  return groups.sort((a, b) => (a.year === null ? 1 : b.year === null ? -1 : b.year - a.year));
}
