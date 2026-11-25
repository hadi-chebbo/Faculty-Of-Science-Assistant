import Link from "next/link";
import { HomeSearch } from "./home-search";

// The home hero: one headline, a real search field and two ways in. A soft coloured background drifts behind
// it (`.hero-blob`, decorative, still under reduced motion). Static: it never reads the session.
export function Hero() {
  return (
    <section className="home-hero rise-in relative isolate overflow-hidden rounded-3xl border bg-card px-5 py-12 text-center md:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-blob absolute -left-20 -top-24 size-72 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="hero-blob absolute -bottom-24 right-0 size-80 rounded-full bg-violet-500/20 blur-3xl [animation-delay:-5s]" />
        <div className="hero-blob absolute left-1/2 top-4 size-48 rounded-full bg-amber-400/20 blur-3xl [animation-delay:-8s]" />
      </div>
      <p className="text-sm font-medium text-link">Computer Science · Faculty of Science · Hadath</p>
      <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
        Find any course, exam or lecture.
      </h1>
      <p className="mx-auto mt-3 max-w-md text-lg text-muted-foreground">
        Search by course code or topic, or choose your year below.
      </p>
      <HomeSearch />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/exams"
          className="inline-flex h-11 items-center rounded-full border bg-background px-5 text-sm font-medium transition-colors hover:border-primary/60 hover:text-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Previous exams
        </Link>
        <Link
          href="#years"
          className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Choose your year
        </Link>
      </div>
    </section>
  );
}
