// PROTOTYPE (throwaway). Variant D: "Dashboard". A greeting + search on the left, the student's continue card on the
// right, then the live course browser, latest files and exam shortcuts. The home reads like an app, not a flyer.
import { ProtoStyles } from "./styles";
import { ContinueCard, LatestList, QuickLinks, SearchBox } from "./parts";
import { YearBrowser } from "./year-browser";

export function VariantD() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-8 py-6 md:py-8">
      <ProtoStyles />
      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="proto-rise relative isolate overflow-hidden rounded-3xl border bg-card p-6 md:p-9">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="proto-float absolute -right-16 -top-16 size-64 rounded-full bg-sky-500/25 blur-3xl" />
            <div className="proto-float absolute -bottom-20 left-10 size-64 rounded-full bg-violet-500/20 blur-3xl [animation-delay:-5s]" />
            <div className="proto-float absolute right-1/3 top-1/2 size-40 rounded-full bg-amber-400/25 blur-3xl [animation-delay:-8s]" />
          </div>
          <p className="text-sm font-semibold text-link">Good to see you 👋</p>
          <h1 className="mt-2 text-balance text-4xl font-black leading-[1.05] tracking-tight md:text-5xl">
            What are we <span className="proto-shine bg-gradient-to-r from-sky-600 via-violet-600 to-sky-600 bg-clip-text text-transparent">studying</span> today?
          </h1>
          <SearchBox className="mt-6 max-w-xl" />
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {["Algorithms", "Databases", "Final exams", "2025"].map((c) => (
              <span key={c} className="rounded-full border bg-background/70 px-3 py-1 text-muted-foreground">{c}</span>
            ))}
          </div>
        </div>
        <div className="proto-rise [animation-delay:120ms]"><ContinueCard /></div>
      </section>

      <section id="years" className="scroll-mt-20">
        <h2 className="mb-3 text-2xl font-bold text-heading">Browse your courses</h2>
        <YearBrowser />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <LatestList />
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-heading">Exams, sorted</h2>
          <QuickLinks />
          <p className="rounded-3xl border bg-muted/50 p-4 text-sm text-muted-foreground">
            Independent student project, free for everyone. Not an official Lebanese University website.
          </p>
        </div>
      </section>
    </main>
  );
}
