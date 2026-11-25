// PROTOTYPE (throwaway). Variant E, second round: calmer and plainer. Flat colour, no glow or gradient text, wording
// for LU Computer Science students. Year cards open the year pages as before; the tabbed browser is a shortcut to courses.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { yearHref, type Year } from "@/lib/years";
import { ProtoStyles } from "./styles";
import { SAMPLE_COURSES, YEAR_STYLE, type YearKey } from "./lang";
import { ContinueCard, LatestList, QuickLinks } from "./parts";
import { SearchBox } from "./search-box";
import { YearBrowser } from "./year-browser";

const KEYS: YearKey[] = [1, 2, 3, 4];

export function VariantE() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-10 py-6 md:gap-12 md:py-8">
      <ProtoStyles />

      {/* hero: centred, the search box is the main action (the first-round "spotlight" search), flat colour */}
      <section className="proto-rise relative isolate overflow-hidden rounded-3xl border bg-card px-5 py-12 text-center md:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="proto-float absolute -left-20 -top-24 size-72 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="proto-float absolute -bottom-24 right-0 size-80 rounded-full bg-violet-500/20 blur-3xl [animation-delay:-5s]" />
          <div className="proto-float absolute left-1/2 top-4 size-48 rounded-full bg-amber-400/20 blur-3xl [animation-delay:-8s]" />
        </div>
        <p className="text-sm font-medium text-link">Computer Science · Faculty of Science · Hadath</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
          Find any course, exam or lecture.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-muted-foreground">Search by course code or topic, or choose your year below.</p>
        <SearchBox className="mx-auto mt-8 max-w-2xl rounded-2xl px-5 py-5 text-left text-lg shadow-xl" />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/exams" className="inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:border-primary/60 hover:text-link">Previous exams</Link>
          <Link href="#years" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">Choose your year</Link>
        </div>
      </section>

      {/* signed-in students only */}
      <div className="proto-rise [animation-delay:100ms]"><ContinueCard /></div>

      {/* years: the way in, as before */}
      <section id="years" className="scroll-mt-20">
        <h2 className="mb-1 text-2xl font-bold text-heading">Choose your year</h2>
        <p className="mb-4 text-muted-foreground">Each year has two semesters of courses.</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KEYS.map((k, i) => {
            const s = YEAR_STYLE[k];
            const courses = SAMPLE_COURSES[k];
            const files = courses.reduce((n, c) => n + c.files, 0);
            const live = courses.length > 0;
            const body = (
              <div className={`proto-rise flex h-full min-h-44 flex-col rounded-3xl border p-5 transition-[transform,box-shadow,border-color] ${live ? `bg-card motion-safe:group-hover:-translate-y-1 group-hover:shadow-md ${s.border}` : "border-dashed bg-muted/40 text-muted-foreground"}`} style={{ animationDelay: `${i * 70}ms` }}>
                <span className="flex items-center gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${live ? s.solid : "bg-muted"}`}>{s.badge}</span>
                  <span className="text-xl font-bold text-heading">{s.label}</span>
                </span>
                {live ? (
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {courses.slice(0, 4).map((c) => <span key={c.code} className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ${s.chip}`}>{c.code}</span>)}
                  </span>
                ) : null}
                <span className="mt-auto flex items-center justify-between pt-5 text-sm">
                  <span className="text-muted-foreground">{live ? `${courses.length} courses · ${files} files` : "No courses yet"}</span>
                  {live && <span className="flex items-center gap-1 font-medium text-link">Open <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" /></span>}
                </span>
              </div>
            );
            return (
              <li key={k}>
                {live ? <Link href={yearHref(k as Year)} className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold text-heading">Jump straight to a course</h2>
        <p className="mb-4 text-muted-foreground">Switch year, then open any course.</p>
        <YearBrowser />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <LatestList />
        <div className="rounded-3xl border bg-card p-5">
          <h2 className="text-lg font-bold text-heading">Previous exams</h2>
          <p className="mb-3 text-sm text-muted-foreground">Filter by course, year and session.</p>
          <QuickLinks stacked />
        </div>
      </section>
    </main>
  );
}
