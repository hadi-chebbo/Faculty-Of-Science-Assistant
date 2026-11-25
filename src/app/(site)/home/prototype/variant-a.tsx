// PROTOTYPE (throwaway). Variant A: "Spotlight". One centred headline, a big search-style entry point with a
// rotating placeholder, drifting colour blobs, then four large year tiles. Nothing else.
import { ArrowUpRight, ClipboardCheck, Search } from "lucide-react";
import Link from "next/link";
import { protoStats } from "./data";
import { yearHref } from "@/lib/years";
import { yearCardText } from "../year-card";
import { ProtoStyles } from "./styles";

const SUGGESTIONS = ["a course code, like DEMO301", "final exam 2025", "graphs", "partial exams"];

export async function VariantA() {
  const stats = await protoStats();
  const { totals } = stats;

  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-10 py-6 md:py-8">
      <ProtoStyles />
      <section className="relative isolate overflow-hidden rounded-3xl border bg-card px-5 py-16 text-center md:py-24">
        {/* drifting blobs + faint dot grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="proto-float absolute -left-24 -top-24 size-80 rounded-full bg-primary/25 blur-3xl" />
          <div className="proto-float absolute -bottom-28 right-0 size-96 rounded-full bg-[#5473FF]/25 blur-3xl [animation-delay:-5s]" />
          <div className="proto-float absolute left-1/2 top-10 size-56 rounded-full bg-highlight/25 blur-3xl [animation-delay:-8s]" />
          <div
            className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
            style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
        </div>

        <p className="proto-rise mx-auto inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          {totals.resources} files and counting
        </p>
        <h1 className="proto-rise mx-auto mt-5 max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight [animation-delay:80ms] md:text-6xl">
          Find any course,{" "}
          <span className="proto-shine bg-gradient-to-r from-primary via-[#5473FF] to-primary bg-clip-text text-transparent">
            exam or lecture
          </span>{" "}
          in seconds.
        </h1>

        {/* the whole box is a link to /search */}
        <Link
          href="/search"
          className="proto-rise group mx-auto mt-9 flex max-w-xl items-center gap-3 rounded-2xl border bg-background px-4 py-4 text-left shadow-xl shadow-primary/10 transition-[box-shadow,border-color] [animation-delay:160ms] hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Search aria-hidden className="size-5 shrink-0 text-link" />
          <span className="proto-cycle relative h-6 flex-1 overflow-hidden text-base text-muted-foreground">
            {SUGGESTIONS.map((text, i) => (
              <span key={text} className="absolute inset-0 truncate" style={{ animationDelay: `${i * 2.5}s` }}>
                Search {text}
              </span>
            ))}
          </span>
          <span className="hidden rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:block">Search</span>
        </Link>

        <div className="proto-rise mt-5 flex flex-wrap justify-center gap-2 [animation-delay:240ms]">
          <Link href="/exams" className="inline-flex h-11 items-center gap-2 rounded-full border bg-background/80 px-4 text-sm font-medium transition-colors hover:border-primary/60 hover:text-link">
            <ClipboardCheck aria-hidden className="size-4" /> Previous exams
          </Link>
          <Link href="#years" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">
            Browse by year
          </Link>
        </div>
      </section>

      <section id="years" className="scroll-mt-20">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.years.map((entry, i) => {
            const text = yearCardText(entry);
            const live = text.counts !== null;
            const body = (
              <div
                className={`proto-rise relative flex h-full min-h-52 flex-col overflow-hidden rounded-3xl border p-6 transition-[transform,box-shadow,border-color] ${
                  live ? "bg-card motion-safe:group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-xl group-hover:shadow-primary/15" : "border-dashed bg-muted/40 text-muted-foreground"
                }`}
                style={{ animationDelay: `${300 + i * 90}ms` }}
              >
                <span
                  aria-hidden
                  className={`absolute -right-3 -top-6 select-none text-[9rem] font-black leading-none tracking-tighter ${
                    live ? "bg-gradient-to-b from-primary/25 to-transparent bg-clip-text text-transparent" : "text-muted/80"
                  }`}
                >
                  {text.circle}
                </span>
                <span className="mt-auto text-2xl font-bold text-heading">{text.label}</span>
                <span className="mt-1 text-sm text-muted-foreground">{live ? text.counts : text.empty}</span>
                {live && (
                  <span className="absolute bottom-5 right-5 flex size-9 items-center justify-center rounded-full bg-primary/10 text-link transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowUpRight aria-hidden className="size-4" />
                  </span>
                )}
              </div>
            );
            return (
              <li key={entry.year}>
                {live ? (
                  <Link href={yearHref(entry.year)} className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
