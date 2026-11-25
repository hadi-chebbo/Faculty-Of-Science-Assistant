"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YEAR_STYLES } from "@/lib/design-language";
import { plural } from "@/lib/plural";
import { semesterLabel, yearLabel, yearSlug, type Year } from "@/lib/years";
import type { HomeCourse, HomeStats } from "@/services/courses/home";

// "Jump straight to a course": one tab per year and, under the selected one, that year's courses. It gets its
// data from the home statistics (already read for the year cards), so the page stays static and needs no account.
// Radix Tabs gives the roles, the announced selection and the arrow keys.
export function CourseBrowser({ years }: { years: HomeStats["years"] }) {
  // Open on the first year that has a course, so a visitor never lands on an empty list while another has courses.
  const initial = years.find((entry) => entry.courses.length > 0) ?? years[0];
  return (
    <Tabs defaultValue={yearSlug(initial.year)} className="gap-4">
      <TabsList
        aria-label="Year"
        className="group-data-horizontal/tabs:h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-1 scroll-fade"
      >
        {years.map((entry) => (
          <TabsTrigger
            key={entry.year}
            value={yearSlug(entry.year)}
            className={`h-11 flex-none rounded-full border-border px-4 text-sm ${TAB_ACTIVE[entry.year]}`}
          >
            {yearLabel(entry.year)}
          </TabsTrigger>
        ))}
        {/* End padding so the edge fade of a scrolling row only covers empty space. */}
        <span aria-hidden className="w-6 flex-none" />
      </TabsList>
      {years.map((entry) => (
        <TabsContent key={entry.year} value={yearSlug(entry.year)} className="text-base">
          {entry.courses.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
              No courses yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entry.courses.map((course) => (
                <li key={course.code}>
                  <CourseCard year={entry.year} course={course} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// The selected tab takes the year's solid colour (the same one as its circle on the year card). Written out in
// full so Tailwind finds the classes.
const TAB_ACTIVE: Record<Year, string> = {
  1: "data-active:border-transparent data-active:bg-sky-700 data-active:text-white dark:data-active:border-transparent dark:data-active:bg-sky-700 dark:data-active:text-white",
  2: "data-active:border-transparent data-active:bg-violet-600 data-active:text-white dark:data-active:border-transparent dark:data-active:bg-violet-600 dark:data-active:text-white",
  3: "data-active:border-transparent data-active:bg-emerald-700 data-active:text-white dark:data-active:border-transparent dark:data-active:bg-emerald-700 dark:data-active:text-white",
  4: "data-active:border-transparent data-active:bg-amber-400 data-active:text-black dark:data-active:border-transparent dark:data-active:bg-amber-400 dark:data-active:text-black",
};

function CourseCard({ year, course }: { year: Year; course: HomeCourse }) {
  const style = YEAR_STYLES[year];
  return (
    <Link
      href={`/courses/${course.code}`}
      className={`group flex h-full min-h-24 flex-col gap-1.5 rounded-2xl border bg-card p-4 transition-[transform,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:hover:-translate-y-0.5 hover:shadow-md ${style.border}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ${style.chip}`}>{course.code}</span>
        <ArrowRight aria-hidden className="size-4 text-link transition-transform motion-safe:group-hover:translate-x-1" />
      </span>
      <span className="text-base font-semibold text-heading">{course.title}</span>
      <span className="mt-auto text-sm text-muted-foreground">
        {semesterLabel(course.semester)} · {plural(course.fileCount, "file")}
      </span>
    </Link>
  );
}
