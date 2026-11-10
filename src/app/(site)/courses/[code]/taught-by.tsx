import Link from "next/link";
import type { LecturerScope } from "@/services/courses/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The address of a course or chapter page with its `tab` and `lecturer` keys (either may be left out).
export function lecturerHref(path: string, { tab, lecturer }: { tab?: string | null; lecturer?: string | null }): string {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  if (lecturer) query.set("lecturer", lecturer);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

// "Dr. Ada Example" -> "AE": a leading title is left out, the first and last word give the letters.
export function initialsOf(name: string): string {
  const words = name
    .replace(/^(?:dr|pr|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((w) => Array.from(w)[0].toUpperCase()).join("");
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
    ...scope.lecturers.map((l) => ({ slug: l.slug as string | null, name: l.name, initials: initialsOf(l.name), count: l.fileCount })),
  ];
  // With a lecturer who has nothing in scope (an empty chapter), no card is current.
  const current = (slug: string | null) =>
    slug === null ? applied === null : slug === applied;
  return (
    <section aria-label="Lecturer" className="mb-6">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Taught by</h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        {items.map((item) => {
          const active = current(item.slug);
          return (
            <li key={item.slug ?? "all"} className="w-40 shrink-0 sm:w-auto">
              <Link
                href={lecturerHref(path, { tab, lecturer: item.slug })}
                aria-current={active ? "true" : undefined}
                className={`flex h-full min-h-14 items-center gap-3 rounded-xl border p-3 transition-colors ${FOCUS} ${
                  active ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-heading"
                  }`}
                >
                  {item.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-heading">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{files(item.count)}</span>
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
  label = "Show all",
}: {
  path: string;
  tab?: string | null;
  lecturer: { name: string } | null;
  label?: string;
}) {
  if (!lecturer) return null;
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Showing files by {lecturer.name} only.{" "}
      <Link
        href={lecturerHref(path, { tab })}
        className={`inline-flex min-h-11 items-center rounded-md text-link underline-offset-4 hover:underline md:min-h-9 ${FOCUS}`}
      >
        {label}
      </Link>
    </p>
  );
}
