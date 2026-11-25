// PROTOTYPE (throwaway). Variant E, second round: calmer and plainer. Flat colour, no glow or gradient text, wording
// for LU Computer Science students. Year cards open the year pages as before; the tabbed browser is a shortcut to courses.
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { yearHref, type Year } from "@/lib/years";
import { ProtoStyles } from "./styles";
import { SAMPLE_COURSES, YEAR_STYLE, type YearKey } from "./lang";
import { ContinueCard, LatestList, QuickLinks, SearchBox } from "./parts";
import { YearBrowser } from "./year-browser";

const KEYS: YearKey[] = [1, 2, 3, 4];

export function VariantE() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-10 py-6 md:gap-12 md:py-8">
      <ProtoStyles />

      {/* hero: the site's own blue, flat; the continue card is for signed-in students only */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="proto-rise rounded-3xl bg-brand-panel p-6 text-brand-panel-foreground md:p-10">
          <p className="text-sm font-medium text-white/80">Computer Science · Faculty of Science · Hadath</p>
          <h1 className="mt-3 max-w-xl text-balance text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">
            Lectures, exercises and past exams for every course.
          </h1>
          <p className="mt-3 max-w-md text-lg text-white/80">Choose your year, or search by course code.</p>
          <SearchBox className="mt-7 max-w-lg text-foreground" />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white">
            <Link href="/exams" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">Past exams <ArrowRight aria-hidden className="size-4" /></Link>
            <Link href="#years" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">Choose your year <ArrowRight aria-hidden className="size-4" /></Link>
          </div>
        </div>
        <div className="proto-rise [animation-delay:100ms]"><ContinueCard /></div>
      </section>

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
