"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { SaveIconButton } from "@/components/site/save-icon-button";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";
import { useSavedLookup } from "@/lib/saved-client";
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
      <StateBlock
        icon={Bookmark}
        actions={
          <Button asChild className="h-11 px-5 md:h-9">
            <Link href="/#semesters">Browse courses</Link>
          </Button>
        }
      >
        Nothing saved yet. Tap the bookmark on any file to keep it here.
      </StateBlock>
    );
  }

  return (
    <div className="space-y-8">
      {visible.map((group) => (
        <section key={group.courseId} aria-labelledby={`course-${group.courseId}`}>
          <h2
            id={`course-${group.courseId}`}
            className="mb-3 flex flex-wrap items-baseline gap-x-2 text-lg font-semibold tracking-tight"
          >
            <Link
              href={`/courses/${encodeURIComponent(group.courseCode)}`}
              className="font-mono text-base text-link underline-offset-4 hover:underline"
            >
              {group.courseCode}
            </Link>
            <span>{group.courseTitle}</span>
            <span className="text-sm font-normal text-muted-foreground">Semester {group.semester}</span>
          </h2>
          <ul className="space-y-2">
            {group.items.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                action={<SaveIconButton resourceId={resource.id} title={resource.title} />}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
