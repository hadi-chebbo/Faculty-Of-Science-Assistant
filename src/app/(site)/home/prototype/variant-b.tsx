// PROTOTYPE (throwaway). Variant B: "Bento". The page is one grid of tiles of different sizes: headline,
// an animated course preview that ticks files off, live numbers, four year tiles, exams, and the account tools.
import { ArrowRight, Bookmark, Check, ListTodo, TrendingUp } from "lucide-react";
import Link from "next/link";
import { protoStats } from "./data";
import { yearHref } from "@/lib/years";
import { yearCardText } from "../year-card";
import { ProtoStyles } from "./styles";

const TINTS = [
  "from-sky-500/15 to-sky-500/0",
  "from-violet-500/15 to-violet-500/0",
  "from-emerald-500/15 to-emerald-500/0",
  "from-amber-500/20 to-amber-500/0",
];

const ROWS = ["Chapter 1: Introduction", "Chapter 2: Fundamentals", "Final exam 2024-2025"];

export async function VariantB() {
  const stats = await protoStats();
  const { totals } = stats;
  const tile = "rounded-3xl border bg-card p-6";

  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container py-6 md:py-8">
      <ProtoStyles />
      <div className="grid gap-4 md:grid-cols-4 md:[grid-auto-rows:minmax(10rem,auto)]">
        {/* headline */}
        <section className="proto-rise relative isolate overflow-hidden rounded-3xl bg-brand-panel p-7 text-brand-panel-foreground md:col-span-2 md:row-span-2 md:p-10">
          <div aria-hidden className="proto-float absolute -bottom-20 -right-16 -z-10 size-72 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="proto-float absolute -top-16 left-1/3 -z-10 size-40 rounded-full bg-highlight/30 blur-3xl [animation-delay:-6s]" />
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl">
            Every course.
            <br />
            One calm place.
          </h1>
          <p className="mt-4 max-w-sm text-lg text-white/80">Lectures, notes and past exams for Computer Science.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#years" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-brand-panel transition-transform hover:-translate-y-0.5">
              Browse courses
            </Link>
            <Link href="/exams" className="inline-flex h-11 items-center rounded-full border border-white/40 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              Previous exams
            </Link>
          </div>
        </section>

        {/* animated preview: files get ticked off in turn */}
        <div aria-hidden className={`${tile} proto-rise select-none md:col-span-2 md:row-span-2 [animation-delay:100ms]`}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your course</p>
          <div className="mt-4 space-y-3">
            {ROWS.map((title, i) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 shadow-sm">
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px]">
                  <span
                    className="proto-check absolute inset-0 flex items-center justify-center rounded-full bg-success text-success-foreground"
                    style={{ animationDelay: `${i * 1.6}s` }}
                  >
                    <Check className="size-4" />
                  </span>
                </span>
                <span className="flex-1 truncate font-medium text-heading">{title}</span>
                <span className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${40 + i * 25}%` }} />
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Mark files as done and watch it fill.</p>
        </div>

        {/* numbers */}
        {[
          { label: "courses", value: totals.courses },
          { label: "files to study from", value: totals.resources },
        ].map(({ label, value }, i) => (
          <div key={label} className={`${tile} proto-rise flex flex-col justify-end md:col-span-1`} style={{ animationDelay: `${200 + i * 80}ms` }}>
            <span className="bg-gradient-to-br from-primary to-[#5473FF] bg-clip-text text-5xl font-black tabular-nums tracking-tight text-transparent">{value}</span>
            <span className="mt-1 text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className={`${tile} proto-rise flex flex-col justify-end md:col-span-2 [animation-delay:360ms]`}>
          <span className="text-sm text-muted-foreground">Exams by session</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {[["partial", "Partial"], ["final", "Final"], ["second", "Second session"]].map(([s, l]) => (
              <Link key={s} href={`/exams?session=${s}`} className="inline-flex h-11 items-center gap-1.5 rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:border-primary/60 hover:text-link">
                {l} <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ))}
          </div>
        </div>

        {/* years */}
        {stats.years.map((entry, i) => {
          const text = yearCardText(entry);
          const live = text.counts !== null;
          const inner = (
            <div className={`${tile} proto-rise relative flex h-full min-h-44 flex-col overflow-hidden bg-gradient-to-br ${live ? TINTS[i % 4] : "border-dashed text-muted-foreground"} transition-[transform,box-shadow] motion-safe:group-hover:-translate-y-1 group-hover:shadow-lg`} style={{ animationDelay: `${400 + i * 80}ms` }}>
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{text.circle}</span>
              <span className="mt-auto text-xl font-bold text-heading">{text.label}</span>
              <span className="text-sm text-muted-foreground">{live ? text.counts : text.empty}</span>
            </div>
          );
          return live ? (
            <Link key={entry.year} id={i === 0 ? "years" : undefined} href={yearHref(entry.year)} className="group scroll-mt-20 rounded-3xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {inner}
            </Link>
          ) : (
            <div key={entry.year} id={i === 0 ? "years" : undefined} className="group">{inner}</div>
          );
        })}

        {/* account tools */}
        <div className={`${tile} proto-rise flex flex-wrap items-center gap-3 md:col-span-4 [animation-delay:760ms]`}>
          <span className="mr-auto font-semibold text-heading">Make it yours <span className="font-normal text-muted-foreground">· free account</span></span>
          {[[Bookmark, "Saved", "/saved"], [ListTodo, "To-do", "/todo"], [TrendingUp, "Progress", "/progress"]].map(([Icon, label, href]) => {
            const I = Icon as typeof Bookmark;
            return (
              <Link key={label as string} href={href as string} className="inline-flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground">
                <I aria-hidden className="size-4" /> {label as string}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
