import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EXAM_SESSIONS, type ExamSession } from "@/db/constants";
import { TYPE_STYLES } from "@/lib/design-language";
import { RESOURCE_TYPE_SINGULAR_LABELS } from "@/lib/labels";
import { readForPage } from "@/lib/page-errors";
import { relativeTime } from "@/lib/relative-time";
import { listRecentResources, type RecentResource } from "@/services/resources/recent";
import { SectionTitle } from "./section-title";

// Fewer files than this and the list would look empty, so the section hides itself.
export const RECENT_MIN = 3;

const SHORTCUT_LABELS: Record<ExamSession, string> = {
  partial: "Partial exams",
  final: "Final exams",
  second: "Second session",
};

// "Recently added" (the newest published files, read in the same suspended section as the year cards; the
// visitor's view, so drafts never show) and the three previous-exam shortcuts. The page is static, so the "how
// long ago" is as of the last render.
export async function RecentAndExams() {
  const recent = await readForPage(() => listRecentResources(null));
  return (
    <>
      {recent.length >= RECENT_MIN && <RecentlyAdded items={recent} now={new Date()} />}
      <ExamShortcuts />
    </>
  );
}

function RecentlyAdded({ items, now }: { items: RecentResource[]; now: Date }) {
  return (
    <section aria-labelledby="recent-title" className="home-recent">
      <div className="flex items-end justify-between gap-3">
        <div id="recent-title">
          <SectionTitle>Recently added</SectionTitle>
        </div>
        <Link
          href="/search"
          className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          See all <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const style = TYPE_STYLES[item.type];
          const Icon = style.icon;
          return (
            <li key={item.id}>
              <Link
                href={`/resources/${item.id}`}
                className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-3 transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-heading">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{item.courseCode}</span> · {RESOURCE_TYPE_SINGULAR_LABELS[item.type]} ·{" "}
                    <time dateTime={item.addedAt.toISOString()}>{relativeTime(item.addedAt, now)}</time>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ExamShortcuts() {
  return (
    <section aria-labelledby="exam-shortcuts-title" className="home-exams">
      <div id="exam-shortcuts-title">
        <SectionTitle>Previous exams</SectionTitle>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {EXAM_SESSIONS.map((session) => (
          <li key={session}>
            <Link
              href={`/exams?session=${session}`}
              className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border bg-card px-4 text-sm font-medium text-heading transition-[border-color,box-shadow] hover:border-rose-500/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {SHORTCUT_LABELS[session]}
              <ArrowRight aria-hidden className="size-4 text-link" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
