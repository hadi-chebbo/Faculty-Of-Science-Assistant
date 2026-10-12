import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { RESOURCE_TYPE_LABELS } from "@/lib/labels";
import type { CourseOutline, ResourceGroup } from "@/services/courses/types";
import type { ResourceListItem } from "@/services/resources/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type CourseView = "chapter" | "type";

// Anything but ?view=type is the default view.
export function parseView(raw: string | string[] | undefined): CourseView {
  return (Array.isArray(raw) ? raw[0] : raw) === "type" ? "type" : "chapter";
}

export function ViewSwitch({ view }: { view: CourseView }) {
  const items: { view: CourseView; label: string; href: string }[] = [
    { view: "chapter", label: "By chapter", href: "?" },
    { view: "type", label: "By type", href: "?view=type" },
  ];
  return (
    <nav aria-label="Course view" className="mb-5 inline-flex rounded-lg border bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.view}
          href={item.href}
          aria-current={item.view === view ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-colors md:min-h-9 ${FOCUS} ${
            item.view === view
              ? "border border-primary/40 bg-card text-heading shadow-sm"
              : "border border-transparent text-muted-foreground hover:text-heading"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Groups({ groups }: { groups: ResourceGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.type}>
          <h3 className="mb-2 text-sm font-medium text-heading">{RESOURCE_TYPE_LABELS[group.type]}</h3>
          <ul className="space-y-2">
            {group.resources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function itemsLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

// Chapters are native <details> so they open and close before any JavaScript has loaded.
export function CourseOutlineView({ code, outline }: { code: string; outline: CourseOutline }) {
  const firstWithItems = outline.chapters.find((c) => c.itemCount > 0);
  const hasGeneral = outline.general.length > 0;
  const hasExams = outline.exams.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {outline.chapters.map((chapter) => (
          <details
            key={chapter.id}
            id={`chapter-${chapter.position}`}
            open={chapter === firstWithItems}
            className="group/chapter scroll-mt-20 rounded-xl border bg-card"
          >
            <summary
              className={`flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2 marker:content-none [&::-webkit-details-marker]:hidden ${FOCUS}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-muted-foreground">Chapter {chapter.position}</span>
                <span className="block font-medium text-heading">{chapter.title}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">{itemsLabel(chapter.itemCount)}</span>
              <ChevronDown
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open/chapter:rotate-180"
              />
            </summary>
            <div className="border-t px-4 py-4">
              {chapter.groups.length > 0 ? (
                <Groups groups={chapter.groups} />
              ) : (
                <p className="text-sm text-muted-foreground">No material yet.</p>
              )}
            </div>
          </details>
        ))}
      </div>

      {hasGeneral && (
        <section aria-labelledby="general-heading">
          <h2 id="general-heading" className="mb-3 text-lg font-semibold tracking-tight">
            General
          </h2>
          <Groups groups={outline.general} />
        </section>
      )}

      {hasExams && <ExamsSection code={code} exams={outline.exams} />}
    </div>
  );
}

function ExamsSection({ code, exams }: { code: string; exams: ResourceListItem[] }) {
  return (
    <section aria-labelledby="exams-heading">
      <h2 id="exams-heading" className="mb-3 text-lg font-semibold tracking-tight">
        Previous exams
      </h2>
      <ul className="space-y-2">
        {exams.map((exam) => (
          <ResourceRow key={exam.id} resource={exam} />
        ))}
      </ul>
      <Link
        href={`/exams?course=${encodeURIComponent(code)}`}
        className={`mt-3 inline-flex min-h-11 items-center rounded-md text-sm text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
      >
        All exams for this course
      </Link>
    </section>
  );
}
