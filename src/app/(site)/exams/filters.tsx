import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PopoverSelect, type PopoverOption } from "@/components/ui/popover-select";
import { courseYearSemesterLabel, groupSemestersByYear, semesterLabel, yearLabel } from "@/lib/years";
import { EXAM_SESSION_LABELS, formatAcademicYear } from "@/lib/labels";
import type { ExamFilterOptions } from "@/services/resources/types";
import { FilterForm } from "./filter-form";
import { countActiveFilters, hasActiveFilters, type ExamParams } from "./params";

const LABEL = "mb-1.5 block text-sm font-medium text-heading";

// A labelled dropdown. Its key includes the value the server settled on, so it follows the address after Back or
// when a course is dropped because it does not fit the semester.
function Field({ id, label, name, noun, value, options }: { id: string; label: string; name: string; noun: string; value: string; options: PopoverOption[] }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <PopoverSelect
        key={`${name}:${value}`}
        id={id}
        name={name}
        noun={noun}
        value={value}
        emptyLabel="All"
        options={options}
        submitOnChange
        className="rounded-xl md:h-11"
        fallback={
          <NativeSelect id={`${id}-native`} name={name} defaultValue={value} aria-label={label} className="w-full [&_select]:h-11">
            <NativeSelectOption value="">All</NativeSelectOption>
            {options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.group ? `${o.group} · ${o.label}` : o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />
    </div>
  );
}

// Every dropdown has an empty "All" option and only offers values that have an exam behind them.
export function ExamFilters({ options, params }: { options: ExamFilterOptions; params: ExamParams }) {
  const courseLabel = (c: { code: string; title: string }) => `${c.code} - ${c.title}`;
  const values = {
    semester: String(params.semester ?? ""),
    course: params.course ?? "",
    year: String(params.year ?? ""),
    session: params.session ?? "",
    lecturer: params.lecturer ?? "",
  };
  const semesterOptions: PopoverOption[] = groupSemestersByYear(options.semesters).flatMap((group) =>
    group.semesters.map((semester) => ({ value: String(semester), label: semesterLabel(semester), group: yearLabel(group.year) })),
  );
  // With no semester chosen the courses are grouped by "Second year · Semester 1"; with one, they are a flat list.
  const courseOptions: PopoverOption[] = options.courses
    .filter((c) => params.semester === undefined || c.semester === params.semester)
    .map((c) => ({ value: c.code, label: courseLabel(c), group: params.semester === undefined ? courseYearSemesterLabel(c.semester) : undefined }));

  return (
    <FilterForm activeCount={countActiveFilters(params)}>
      <div className="rounded-3xl border bg-card p-4 md:p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field id="exam-semester" label="Semester" name="semester" noun="semester" value={values.semester} options={semesterOptions} />
          <Field id="exam-course" label="Course" name="course" noun="course" value={values.course} options={courseOptions} />
          <Field
            id="exam-year"
            label="Academic year"
            name="year"
            noun="year"
            value={values.year}
            options={options.years.map((year) => ({ value: String(year), label: formatAcademicYear(year) }))}
          />
          <Field
            id="exam-session"
            label="Session"
            name="session"
            noun="session"
            value={values.session}
            options={options.sessions.map((session) => ({ value: session, label: EXAM_SESSION_LABELS[session] }))}
          />
          <Field
            id="exam-lecturer"
            label="Lecturer"
            name="lecturer"
            noun="lecturer"
            value={values.lecturer}
            options={options.lecturers.map((l) => ({ value: l.slug, label: l.name }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0 lg:flex-nowrap">
          <Button type="submit" className="h-11 rounded-xl px-5">
            Apply
          </Button>
          {hasActiveFilters(params) && (
            <Button asChild variant="ghost" className="h-11 rounded-xl px-4">
              <Link href="/exams">Clear filters</Link>
            </Button>
          )}
        </div>
      </div>
    </FilterForm>
  );
}
