// PROTOTYPE (throwaway): pieces both new variants use, written in the shared design language.
import { ArrowRight, Play, Search } from "lucide-react";
import Link from "next/link";
import { SAMPLE_LATEST, TYPE_STYLE } from "./lang";

export function SearchBox({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/search"
      className={`group flex items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 shadow-lg shadow-primary/10 transition-[box-shadow,border-color] hover:border-primary/60 hover:shadow-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className}`}
    >
      <Search aria-hidden className="size-5 shrink-0 text-link" />
      <span className="proto-cycle relative h-6 flex-1 overflow-hidden text-muted-foreground">
        {["Search by course code or topic", "Try: final exam 2025", "Try: graphs", "Try: partial"].map((t, i) => (
          <span key={t} className="absolute inset-0 truncate" style={{ animationDelay: `${i * 2.5}s` }}>{t}</span>
        ))}
      </span>
      <span className="hidden rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:block">Search</span>
    </Link>
  );
}

// Signed-in only in the real page (from /api/v1/progress); sample values here.
export function ContinueCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-link">Continue where you left off</p>
      <p className="mt-2 text-xl font-bold text-heading">Algorithms · Sorting</p>
      <p className="text-sm text-muted-foreground">DEMO301 · page 7 of 24</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-primary" /></div>
        <span className="text-sm font-semibold tabular-nums text-heading">62%</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Link href="/progress" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          <Play aria-hidden className="size-4 fill-current" /> Resume
        </Link>
        <WeekDots />
      </div>
    </div>
  );
}

export function WeekDots() {
  const active = [true, true, false, true, false, false, false];
  return (
    <div className="ml-auto flex items-center gap-2">
      <ul aria-label="This week" className="flex gap-1">
        {"MTWTFSS".split("").map((d, i) => (
          <li key={i} className={`flex size-6 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${active[i] ? "bg-primary text-primary-foreground" : "border text-muted-foreground"} ${i === 3 ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-card" : ""}`}>
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LatestList() {
  return (
    <div className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-heading">Recently added</h2>
        <Link href="/search" className="flex items-center gap-1 text-sm font-medium text-link">See all <ArrowRight aria-hidden className="size-4" /></Link>
      </div>
      <ul className="mt-3 space-y-2">
        {SAMPLE_LATEST.map((f) => {
          const t = TYPE_STYLE[f.type];
          const Icon = t.icon;
          return (
            <li key={f.title}>
              <Link href="/search" className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.chip}`}><Icon aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-heading">{f.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{f.course} · {t.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{f.when}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function QuickLinks({ stacked = false }: { stacked?: boolean }) {
  const items = [
    { href: "/exams?session=partial", label: "Partial exams", sub: "Mid-semester papers", chip: "bg-rose-500/15 text-rose-800 dark:text-rose-300" },
    { href: "/exams?session=final", label: "Final exams", sub: "Newest year first", chip: "bg-orange-500/15 text-orange-800 dark:text-orange-300" },
    { href: "/exams?session=second", label: "Second session", sub: "Retake papers", chip: "bg-teal-500/15 text-teal-800 dark:text-teal-300" },
  ];
  return (
    <div className={stacked ? "grid gap-2" : "grid gap-3 sm:grid-cols-3"}>
      {items.map((x) => (
        <Link key={x.href} href={x.href} className="group flex items-center gap-3 rounded-2xl border bg-background p-3 transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-md">
          <span className={`flex size-11 items-center justify-center rounded-2xl ${x.chip}`}><ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-0.5" /></span>
          <span><span className="block font-semibold text-heading">{x.label}</span><span className="text-sm text-muted-foreground">{x.sub}</span></span>
        </Link>
      ))}
    </div>
  );
}
