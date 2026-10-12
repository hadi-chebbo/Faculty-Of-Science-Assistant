import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { EXAM_SESSION_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ExamFilterOptions } from "@/services/resources/types";
import { FilterForm } from "./filter-form";
import { hasActiveFilters, type ExamParams } from "./params";

// Phones get taller selects (comfortable tap targets); from md up they match the other inputs.
const SELECT = "w-full [&_select]:h-11 md:[&_select]:h-9";
const LABEL = "mb-1.5 block text-sm font-medium text-heading";

// Every dropdown has an empty "All" option and only offers values that have an exam behind them.
export function ExamFilters({ options, params }: { options: ExamFilterOptions; params: ExamParams }) {
  const courseLabel = (c: { code: string; title: string }) => `${c.code} - ${c.title}`;
  const values = {
    semester: String(params.semester ?? ""),
    course: params.course ?? "",
    year: String(params.year ?? ""),
    session: params.session ?? "",
  };
  const courses =
    params.semester === undefined
      ? options.semesters.map((semester) => ({
          semester,
          courses: options.courses.filter((c) => c.semester === semester),
        }))
      : null;

  return (
    <FilterForm values={values}>
      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="exam-semester" className={LABEL}>Semester</label>
            <NativeSelect id="exam-semester" name="semester" defaultValue={values.semester} className={SELECT}>
              <NativeSelectOption value="">All</NativeSelectOption>
              {options.semesters.map((semester) => (
                <NativeSelectOption key={semester} value={semester}>
                  Semester {semester}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="exam-course" className={LABEL}>Course</label>
            <NativeSelect id="exam-course" name="course" defaultValue={values.course} className={SELECT}>
              <NativeSelectOption value="">All</NativeSelectOption>
              {courses
                ? courses.map((group) => (
                    <NativeSelectOptGroup key={group.semester} label={`Semester ${group.semester}`}>
                      {group.courses.map((c) => (
                        <NativeSelectOption key={c.code} value={c.code}>
                          {courseLabel(c)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))
                : options.courses
                    .filter((c) => c.semester === params.semester)
                    .map((c) => (
                      <NativeSelectOption key={c.code} value={c.code}>
                        {courseLabel(c)}
                      </NativeSelectOption>
                    ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="exam-year" className={LABEL}>Academic year</label>
            <NativeSelect id="exam-year" name="year" defaultValue={values.year} className={SELECT}>
              <NativeSelectOption value="">All</NativeSelectOption>
              {options.years.map((year) => (
                <NativeSelectOption key={year} value={year}>
                  {formatAcademicYear(year)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="exam-session" className={LABEL}>Session</label>
            <NativeSelect id="exam-session" name="session" defaultValue={values.session} className={SELECT}>
              <NativeSelectOption value="">All</NativeSelectOption>
              {options.sessions.map((session) => (
                <NativeSelectOption key={session} value={session}>
                  {EXAM_SESSION_LABELS[session]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit" className="h-11 px-4 md:h-9 md:px-3">
            Apply
          </Button>
          {hasActiveFilters(params) && (
            <Button asChild variant="ghost" className="h-11 px-4 md:h-9 md:px-3">
              <Link href="/exams">Clear filters</Link>
            </Button>
          )}
        </div>
      </div>
    </FilterForm>
  );
}
