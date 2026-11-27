"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { AddToTodoIconButton } from "@/components/site/add-to-todo-icon-button";
import { ResourceRow } from "@/components/site/resource-row";
import { IconCard } from "@/components/site/icon-card";
import { YearCircle } from "@/components/site/year-badge";
import { Button } from "@/components/ui/button";
import { useSavedLookup } from "@/lib/saved-client";
import { YEAR_STYLES } from "@/lib/design-language";
import { courseYearSemesterLabel, yearOfSemester } from "@/lib/years";
import type { SavedCourseGroup } from "@/services/saved/saved";

// The server-rendered groups. An item the shared store reports as not saved (just removed here, or
// in another control on the page) is hidden at once; while the store is still unknown, the server
// list is trusted. A course with nothing left disappears; with nothing left at all, the empty state.
export function SavedList({ groups }: { groups: SavedCourseGroup[] }) {
  const { isRemoved } = useSavedLookup();
  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !isRemoved(item.id)) }))
    .filter((group) => group.items.length > 0);

  if (visible.length === 0) {
    return (
      <IconCard
        icon={Bookmark}
        actions={
          <Button asChild className="h-11 rounded-xl px-5 md:h-10">
            <Link href="/#years">Browse courses</Link>
          </Button>
        }
      >
        <p className="mt-4 max-w-md">Nothing saved yet. Tap the bookmark on any file to keep it here.</p>
      </IconCard>
    );
  }

  return (
    <div className="space-y-8">
      {visible.map((group) => {
        const year = yearOfSemester(group.semester);
        return (
          <section key={group.courseId} aria-labelledby={`course-${group.courseId}`}>
            <div className="mb-3 flex items-center gap-3">
              <YearCircle year={year} className="size-7 text-xs" />
              <h2
                id={`course-${group.courseId}`}
                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold tracking-tight"
              >
                <Link
                  href={`/courses/${encodeURIComponent(group.courseCode)}`}
                  className={`inline-flex min-h-11 items-center rounded-full px-2.5 font-mono text-xs font-semibold underline-offset-4 hover:underline md:min-h-7 ${YEAR_STYLES[year].chip}`}
                >
                  {group.courseCode}
                </Link>
                <span className="line-clamp-2 min-w-0">{group.courseTitle}</span>
                <span className="text-sm font-normal text-muted-foreground">{courseYearSemesterLabel(group.semester)}</span>
              </h2>
            </div>
            {/* The shared ResourceRow renders an `li` root with its own border, background and radius classes (and
                I may not edit it), so inside this card they are overridden from here; the hover border (border-primary/40) stays. */}
            <ul className="space-y-1 rounded-3xl border bg-card p-1.5 [&>li]:rounded-2xl [&>li]:border-transparent [&>li]:bg-transparent">
              {group.items.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} action={<AddToTodoIconButton resourceId={resource.id} title={resource.title} />} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
