import { notFound, permanentRedirect } from "next/navigation";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { yearHref, yearOfSemester } from "@/lib/years";
import { semesterSchema } from "@/services/courses/schemas";

// Old semester links keep working: /semesters/3 moves permanently to /years/2#semester-1. The stored
// 1-6 number is only used to find the place. Anything else is the not-found page.
export function generateStaticParams() {
  return Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => ({
    semester: String(SEMESTER_MIN + i),
  }));
}

export default async function SemesterRedirect({ params }: PageProps<"/semesters/[semester]">) {
  const { semester: param } = await params;
  // Plain digits only ("3", not "3.0" or " 3"), then the shared semester rule.
  const parsed = /^\d+$/.test(param) ? semesterSchema.safeParse(param) : null;
  if (!parsed?.success) notFound();
  permanentRedirect(yearHref(yearOfSemester(parsed.data), parsed.data));
}
