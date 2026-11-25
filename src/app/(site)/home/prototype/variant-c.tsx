// PROTOTYPE (throwaway). Variant C: "Immersive". A deep-blue hero with two rows of course codes scrolling in
// opposite directions, then the years as a big editorial list (no cards).
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { protoStats } from "./data";
import { yearHref } from "@/lib/years";
import { yearCardText } from "../year-card";
import { ProtoStyles } from "./styles";

function MarqueeRow({ codes, className }: { codes: string[]; className: string }) {
  // The list is doubled so translating by -50% loops seamlessly.
  const items = [...codes, ...codes];
  return (
    <div className="overflow-hidden">
      <div className={`${className} flex w-max gap-3`}>
        {items.map((code, i) => (
          <span key={`${code}-${i}`} className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-mono text-sm text-white/90 backdrop-blur">
            {code}
          </span>
        ))}
      </div>
    </div>
  );
}

export async function VariantC() {
  const stats = await protoStats();
  const base = stats.years.flatMap((y) => y.courseCodes);
  // Enough chips to fill a wide screen even with only a few demo courses.
  const codes = base.length === 0 ? ["CODE101", "CODE202", "CODE303"] : base;
  const filled = Array.from({ length: Math.max(8, codes.length) }, (_, i) => codes[i % codes.length]);

  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-12 py-6 md:py-8">
      <ProtoStyles />
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-brand-panel py-14 text-center text-brand-panel-foreground md:py-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(60% 80% at 20% 0%, rgba(84,115,255,.55), transparent), radial-gradient(50% 70% at 90% 100%, rgba(253,185,31,.25), transparent), radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 24px 24px",
          }}
        />
        <div className="px-5">
          <h1 className="proto-rise mx-auto max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
            Study without the scavenger hunt.
          </h1>
          <div className="proto-rise mt-8 flex flex-wrap justify-center gap-3 [animation-delay:120ms]">
            <Link href="#years" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-brand-panel transition-transform hover:-translate-y-0.5">
              Pick your year <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/exams" className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10">
              Previous exams
            </Link>
          </div>
        </div>
        <div aria-hidden className="proto-rise mt-12 space-y-3 [animation-delay:240ms] [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <MarqueeRow codes={filled} className="proto-marquee" />
          <MarqueeRow codes={[...filled].reverse()} className="proto-marquee-rev" />
        </div>
      </section>

      <section id="years" className="scroll-mt-20">
        <ul className="divide-y border-y">
          {stats.years.map((entry, i) => {
            const text = yearCardText(entry);
            const live = text.counts !== null;
            const row = (
              <div className={`proto-rise flex items-center gap-4 px-2 py-6 transition-[background-color,padding] md:gap-8 md:py-8 ${live ? "group-hover:bg-muted/70 md:group-hover:pl-6" : "text-muted-foreground"}`} style={{ animationDelay: `${150 + i * 90}ms` }}>
                <span className={`w-14 shrink-0 text-4xl font-black tabular-nums md:w-24 md:text-6xl ${live ? "text-primary/30 transition-colors group-hover:text-primary" : "text-muted"}`}>
                  {text.circle}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-2xl font-bold text-heading md:text-4xl">{text.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{live ? text.counts : text.empty}</span>
                </span>
                {live && (
                  <span className="hidden flex-wrap justify-end gap-1.5 lg:flex">
                    {text.codes.map((c) => (
                      <span key={c} className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium text-link">{c}</span>
                    ))}
                  </span>
                )}
                {live && (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowRight aria-hidden className="size-5 transition-transform motion-safe:group-hover:translate-x-0.5" />
                  </span>
                )}
              </div>
            );
            return (
              <li key={entry.year}>
                {live ? (
                  <Link href={yearHref(entry.year)} className="group block focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
