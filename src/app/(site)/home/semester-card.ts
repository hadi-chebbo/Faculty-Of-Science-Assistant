// The wording of one semester card on the home page. Pure, so the cases the demo data cannot
// show (a semester with no course) are covered by unit tests.
export interface SemesterCardText {
  tag: "Autumn" | "Spring";
  label: string; // "S3"
  name: string; // "Semester 3"
  // null: the semester has no course, so the card is not a link and shows `empty` instead.
  counts: string | null;
  empty: string | null;
}

// The strip of totals is only worth showing once there is a catalogue to count.
export const STATS_MIN_COURSES = 5;

export function showStats(courses: number): boolean {
  return courses >= STATS_MIN_COURSES;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function semesterCardText(entry: {
  semester: number;
  courseCount: number;
  resourceCount: number;
}): SemesterCardText {
  const autumn = entry.semester % 2 === 1;
  const base = {
    tag: autumn ? ("Autumn" as const) : ("Spring" as const),
    label: `S${entry.semester}`,
    name: `Semester ${entry.semester}`,
  };
  if (entry.courseCount > 0) {
    return {
      ...base,
      counts: `${plural(entry.courseCount, "course", "courses")} · ${plural(entry.resourceCount, "file", "files")}`,
      empty: null,
    };
  }
  return { ...base, counts: null, empty: autumn ? "No material yet" : "Material arrives in spring" };
}
