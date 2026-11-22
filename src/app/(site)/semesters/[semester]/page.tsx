import { notFound, permanentRedirect } from "next/navigation";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { yearHref, yearOfSemester } from "@/lib/years";

// Old semester links keep working: /semesters/3 moves permanently to /years/2#semester-1. The stored
// 1-6 number is only used to find the place. Anything else is the not-found page.
export function generateStaticParams() {
  return Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => ({
    semester: String(SEMESTER_MIN + i),
  }));
}

export default async function SemesterRedirect({ params }: PageProps<"/semesters/[semester]">) {
  const { semester: param } = await params;
  const semester = /^\d+$/.test(param) ? Number(param) : NaN;
  if (!(semester >= SEMESTER_MIN && semester <= SEMESTER_MAX)) notFound();
  permanentRedirect(yearHref(yearOfSemester(semester), semester));
}
