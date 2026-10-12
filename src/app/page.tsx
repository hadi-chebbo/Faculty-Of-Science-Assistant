import { BookOpen, FileText, Smartphone } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";

const BENEFITS = [
  { icon: BookOpen, title: "Everything in one place", text: "Lectures, notes and exercises for each course." },
  { icon: FileText, title: "Previous exams", text: "Past exams and their solutions, by year and session." },
  { icon: Smartphone, title: "Made for your phone", text: "Fast pages that work on a slow connection." },
];

const SEMESTERS = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => SEMESTER_MIN + i);

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">University Assistant</h1>
        <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
        <p className="mt-4 text-lg">
          Course material and previous exams for Computer Science students, Faculty of Science, Lebanese University.
        </p>
        <Button asChild size="lg" className="mt-6 h-11 px-5 text-base">
          <Link href="#semesters">Browse courses</Link>
        </Button>
      </section>

      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-link" aria-hidden />
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <section id="semesters" className="mt-12 scroll-mt-20">
        <h2 className="sr-only">Semesters</h2>
        <PageTitle>Choose a semester</PageTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEMESTERS.map((semester) => (
            <Link
              key={semester}
              href={`/semesters/${semester}`}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-xl text-heading">S{semester}</CardTitle>
                  <CardDescription>Semester {semester}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
