import { BookOpen, ChevronRight, FileText, Smartphone } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";

const BENEFITS = [
  { icon: BookOpen, title: "Everything in one place", text: "Lectures, notes and exercises for each course." },
  { icon: FileText, title: "Previous exams", text: "Past exams and their solutions, by year and session." },
  { icon: Smartphone, title: "Made for your phone", text: "Fast pages that work on a slow connection." },
];

const SEMESTERS = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => SEMESTER_MIN + i);

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <section className="rounded-xl border bg-card px-5 py-7 md:px-10 md:py-12">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">University Assistant</h1>
        <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
        <p className="mt-4 max-w-2xl text-base md:text-lg">
          Course material and previous exams for Computer Science students, Faculty of Science, Lebanese University.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="#semesters">Browse courses</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
            <Link href="/exams">Previous exams</Link>
          </Button>
        </div>
      </section>

      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-lg border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-link">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-0.5 text-sm">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <section id="semesters" className="mt-10 scroll-mt-20 md:mt-12">
        <h2 className="sr-only">Semesters</h2>
        <PageTitle>Choose a semester</PageTitle>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEMESTERS.map((semester) => (
            <li key={semester}>
              <Link
                href={`/semesters/${semester}`}
                className="group flex h-full min-h-20 items-center justify-between gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span>
                  <span className="block text-xl font-semibold text-heading">S{semester}</span>
                  <span className="block text-sm text-muted-foreground">Semester {semester}</span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-link"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
