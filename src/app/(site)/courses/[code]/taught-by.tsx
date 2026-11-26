import { Users } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { lecturerInitials } from "@/lib/lecturer-name";
import type { LecturerRef } from "@/services/lecturers/types";
import type { LecturerScope } from "@/services/courses/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// From this many lecturers the strip is one sideways-scrolling row at every width.
export const SCROLL_ROW_FROM = 5;

// The address of a course or chapter page with its `tab` and `lecturer` keys (either may be left out).
export function pageHref(path: string, { tab, lecturer }: { tab?: string | null; lecturer?: string | null }): string {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  if (lecturer) query.set("lecturer", lecturer);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

const files = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

// The "Taught by" strip: shown only when two or more lecturers have published files in scope.
// Cards are links that change only `lecturer` and keep `tab`.
export function TaughtBy({
  path,
  tab,
  scope,
}: {
  path: string;
  tab?: string | null;
  scope: LecturerScope;
}) {
  if (scope.lecturers.length < 2) return null;
  const applied = scope.lecturer?.slug ?? null;
  const items = [
    { slug: null as string | null, name: "All lecturers", initials: "All", count: scope.allFileCount },
    ...scope.lecturers.map((l) => ({ slug: l.slug as string | null, name: l.name, initials: lecturerInitials(l.name), count: l.fileCount })),
  ];
  // With a lecturer who has nothing in scope (an empty chapter), no card is current.
  const current = (slug: string | null) =>
    slug === null ? applied === null : slug === applied;
  // From SCROLL_ROW_FROM lecturers the strip stays one sideways-scrolling row at every width; below
  // that it is a row on a phone and a 4-column grid from sm up.
  const row = scope.lecturers.length >= SCROLL_ROW_FROM;
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Taught by</h2>
      <ul
        aria-label="Lecturer"
        data-layout={row ? "row" : "grid"}
        className={
          row
            ? "scroll-fade -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            : "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0"
        }
      >
        {items.map((item) => {
          const active = current(item.slug);
          return (
            <li key={item.slug ?? "all"} className={row ? "w-48 shrink-0" : "w-40 shrink-0 sm:w-auto"}>
              <Link
                href={pageHref(path, { tab, lecturer: item.slug })}
                aria-current={active ? "true" : undefined}
                className={`flex h-full min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${FOCUS} ${
                  active ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40"
                }`}
              >
                <Avatar aria-hidden className="size-10">
                  <AvatarFallback
                    className={`text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-heading"}`}
                  >
                    {item.slug === null ? <Users className="size-4" /> : item.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-heading">{item.name}</span>
                  {/* Muted text falls under 4.5:1 on the chosen card's primary tint in the light theme. */}
                  <span className={`block text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{files(item.count)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// "Showing files by NAME only." with a link that drops only `lecturer`.
export function ShowingOnly({
  path,
  tab,
  lecturer,
}: {
  path: string;
  tab?: string | null;
  lecturer: LecturerRef | null;
}) {
  if (!lecturer) return null;
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Showing files by {lecturer.name} only.{" "}
      <Link
        href={pageHref(path, { tab })}
        className={`inline-flex min-h-11 items-center rounded-md text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
      >
        Show all
      </Link>
    </p>
  );
}
