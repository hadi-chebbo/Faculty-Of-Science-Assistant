// PROTOTYPE (throwaway). Variant E: "Playful". A centred, colourful hero with floating sticker cards around the
// headline and search, a stats ribbon, then the live browser, with progress and latest side by side below.
import { BookOpen, CheckCircle2, ClipboardCheck, Sparkles } from "lucide-react";
import { ProtoStyles } from "./styles";
import { ContinueCard, LatestList, SearchBox } from "./parts";
import { YearBrowser } from "./year-browser";

function Sticker({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className={`proto-float absolute hidden items-center gap-2 rounded-2xl border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-xl lg:flex ${className}`}>
      {children}
    </div>
  );
}

export function VariantE() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-8 py-6 md:py-8">
      <ProtoStyles />
      <section className="relative isolate overflow-hidden rounded-[2rem] border bg-gradient-to-b from-sky-500/15 via-violet-500/10 to-card px-5 py-14 text-center md:py-20">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" style={{ backgroundImage: "radial-gradient(var(--border) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />
        <Sticker className="left-[7%] top-[22%] -rotate-6"><span className="flex size-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300"><BookOpen className="size-4" /></span>Chapter 4: Graphs</Sticker>
        <Sticker className="right-[7%] top-[18%] rotate-6 [animation-delay:-4s]"><span className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300"><ClipboardCheck className="size-4" /></span>Final exam 2025</Sticker>
        <Sticker className="bottom-[16%] left-[10%] rotate-3 [animation-delay:-7s]"><span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /></span>13 of 13 done</Sticker>
        <Sticker className="bottom-[20%] right-[9%] -rotate-3 [animation-delay:-2s]"><span className="flex size-8 items-center justify-center rounded-xl bg-amber-400/25 text-amber-800 dark:text-amber-300"><Sparkles className="size-4" /></span>3 active days</Sticker>

        <h1 className="proto-rise mx-auto max-w-3xl text-balance text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
          Your whole degree,{" "}
          <span className="proto-shine bg-gradient-to-r from-sky-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">one tap away</span>.
        </h1>
        <SearchBox className="proto-rise mx-auto mt-8 max-w-xl text-left [animation-delay:120ms]" />
        <ul className="proto-rise mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground [animation-delay:200ms]">
          {["300+ files", "Every year + Master 1", "Free, no account to browse"].map((t) => (
            <li key={t} className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" aria-hidden />{t}</li>
          ))}
        </ul>
      </section>

      <section id="years" className="scroll-mt-20">
        <h2 className="mb-3 text-2xl font-bold text-heading">Pick a year, pick a course</h2>
        <YearBrowser />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ContinueCard />
        <LatestList />
      </section>
    </main>
  );
}
