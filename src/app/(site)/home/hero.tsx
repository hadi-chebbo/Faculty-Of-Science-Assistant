import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const FACTS = ["No account needed", "Free", "Works on your phone"];

const PREVIEW_YEARS = [
  {
    year: "2024-2025",
    rows: [
      { session: "Partial", title: "Sample partial exam 2024", solution: true },
      { session: "Final", title: "Sample final exam 2024", solution: true },
    ],
  },
  { year: "2023-2024", rows: [{ session: "Partial", title: "Sample partial exam 2023", solution: false }] },
];

export function Hero() {
  return (
    <section className="grid gap-7 rounded-2xl border bg-card px-5 py-7 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-10 md:px-10 md:py-12">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-link">
          Computer Science · Faculty of Science · Hadath
        </p>
        <h1 className="mt-3 text-balance text-[2rem] font-bold leading-[1.08] tracking-tight md:text-5xl">
          Every course, chapter and past exam in one place.
        </h1>
        <p className="mt-4 max-w-[46ch] text-[1.0625rem]">
          Lectures, notes, exercises and previous exams for semesters 3 to 6, organised the way your courses are taught.
          Stop digging through Drive links.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="#semesters">Browse courses</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
            <Link href="/exams">Previous exams</Link>
          </Button>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {FACTS.map((fact) => (
            <li key={fact} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-highlight" aria-hidden />
              {fact}
            </li>
          ))}
        </ul>
      </div>
      <CoursePreview />
    </section>
  );
}

// A decorative illustration with fixed sample text: not interactive, not read from the database,
// and hidden from assistive technology so it is not announced as real content.
function CoursePreview() {
  return (
    <div
      aria-hidden="true"
      className="min-w-0 select-none rounded-xl border bg-background p-4 shadow-xl shadow-primary/10"
    >
      <p className="mb-2.5 text-xs text-muted-foreground">What a course looks like</p>
      <span className="font-mono text-xs font-medium text-link">DEMO310</span>
      <p className="text-[1.0625rem] font-semibold text-heading">Sample Full Course A</p>
      <div className="my-3 flex gap-1 rounded-lg border bg-muted p-1 text-[0.8125rem]">
        {["Chapters", "Previous exams", "Other material"].map((tab) => (
          <span
            key={tab}
            className={`flex-1 truncate rounded-md px-1 py-1.5 text-center ${
              tab === "Previous exams" ? "border bg-card font-medium text-heading" : "text-muted-foreground"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>
      {PREVIEW_YEARS.map(({ year, rows }) => (
        <div key={year}>
          <p className="mb-1.5 mt-3 text-[0.8125rem] font-semibold text-heading">{year}</p>
          {rows.map((row) => (
            <div key={row.title} className="mt-1.5 flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-muted text-link">
                <ClipboardCheck className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-heading">{row.session}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.title}</span>
              </span>
              {row.solution && <span className="text-[0.8125rem] font-medium text-link">Solution</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
