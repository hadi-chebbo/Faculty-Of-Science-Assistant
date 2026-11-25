"use client";
// PROTOTYPE (throwaway): the live course browser. Year tabs switch the course cards in place.
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SAMPLE_COURSES, YEAR_STYLE, type YearKey } from "./lang";

const KEYS: YearKey[] = [1, 2, 3, 4];

export function YearBrowser() {
  const [year, setYear] = useState<YearKey>(2);
  const s = YEAR_STYLE[year];
  const courses = SAMPLE_COURSES[year];
  return (
    <div>
      <div role="tablist" aria-label="Year" className="flex gap-2 overflow-x-auto pb-1">
        {KEYS.map((k) => {
          const active = k === year;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active}
              onClick={() => setYear(k)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all ${
                active ? `${YEAR_STYLE[k].solid} border-transparent shadow-md` : "bg-card hover:bg-muted"
              }`}
            >
              <span className={`flex size-6 items-center justify-center rounded-full text-xs ${active ? "bg-white/25" : YEAR_STYLE[k].chip}`}>{YEAR_STYLE[k].badge}</span>
              {YEAR_STYLE[k].label}
            </button>
          );
        })}
      </div>

      {courses.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed bg-muted/40 p-10 text-center text-muted-foreground">No Master 1 courses yet.</div>
      ) : (
        <ul key={year} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c, i) => (
            <li key={c.code} className="proto-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <Link
                href={`/courses/${c.code}`}
                className={`group relative flex h-full min-h-40 flex-col overflow-hidden rounded-3xl border bg-card p-5 transition-[transform,box-shadow,border-color] motion-safe:hover:-translate-y-1 hover:shadow-lg ${s.border} focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
              >
                <span className={`w-fit rounded-lg px-2 py-0.5 font-mono text-xs font-semibold ${s.chip}`}>{c.code}</span>
                <span className="mt-3 text-lg font-bold leading-snug text-heading">{c.title}</span>
                <span className="mt-auto flex items-center justify-between pt-4 text-sm text-muted-foreground">
                  <span>Semester {c.semester} · {c.files} files</span>
                  <span className={`flex size-8 items-center justify-center rounded-full transition-colors ${s.chip} group-hover:bg-primary group-hover:text-primary-foreground`}>
                    <ArrowUpRight aria-hidden className="size-4" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
