import { ClipboardCheck, ListTree, PencilLine, Smartphone } from "lucide-react";
import Link from "next/link";
import { examsHref } from "@/app/(site)/exams/params";
import type { ExamSession } from "@/db/constants";
import { SectionTitle } from "./section-title";

const STEPS = [
  { title: "Pick your semester", text: "Semesters 3 to 6 of the Computer Science programme, each with its own course list." },
  { title: "Open a course", text: "See its chapters at a glance, with what each one holds: lectures, notes and exercise sheets." },
  { title: "Study, or go straight to exams", text: "Work through a chapter in order, or jump to previous exams grouped by year." },
];

const FEATURES = [
  {
    icon: ListTree,
    title: "Courses split into chapters",
    text: "Each chapter has its own page with its lectures, notes and exercises, and Previous and Next to move through the course.",
  },
  {
    icon: ClipboardCheck,
    title: "Previous exams by year",
    text: "Partial, final and second session, newest year first, with the solution beside the exam when there is one.",
  },
  {
    icon: PencilLine,
    title: "Exercises with their solutions",
    text: "A solution sits on the same row as the sheet it answers, so you never search for the matching file.",
  },
  {
    icon: Smartphone,
    title: "Built for a phone and a slow connection",
    text: "Light pages, large tap targets, and a light or dark theme that follows your device.",
  },
];

const SESSIONS: { session: ExamSession; label: string }[] = [
  { session: "partial", label: "Partial exams" },
  { session: "final", label: "Final exams" },
  { session: "second", label: "Second session" },
];

const QUESTIONS = [
  {
    q: "Is this an official university website?",
    a: "No. It is an independent project built by a student, for students. It is not run or endorsed by the Lebanese University.",
  },
  { q: "Do I need an account?", a: "No. Browsing, opening and downloading files never require an account." },
  {
    q: "Which courses are covered?",
    a: "Computer Science, semesters 3 to 6, Faculty of Science, Hadath branch. Semesters 1 and 2 are not covered.",
  },
  { q: "Does it cost anything?", a: "No. Everything on the site is free." },
];

export function HowItWorks() {
  return (
    <section>
      <SectionTitle>How it works</SectionTitle>
      <ol className="grid gap-5 md:grid-cols-3 md:gap-3">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="border-t-2 pt-3.5 [counter-increment:step] before:mb-2.5 before:grid before:size-7 before:place-items-center before:rounded-full before:bg-primary before:text-sm before:font-semibold before:text-primary-foreground before:content-[counter(step)]"
          >
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="mt-1 text-[0.9375rem]">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function WhatYouWillFind() {
  return (
    <section>
      <SectionTitle>What you will find</SectionTitle>
      <ul className="grid md:grid-cols-2 md:gap-x-10">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3.5 border-t py-[18px]">
            <span className="flex size-[38px] shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-0.5 text-[0.9375rem]">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ExamBand() {
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-primary px-5 py-6 text-primary-foreground md:gap-8 md:px-9 md:py-8">
      <div className="min-w-0 flex-[1_1_280px]">
        <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground">Exams coming up?</h2>
        <p className="mt-1.5 max-w-[44ch]">
          Go straight to past papers from every course, and filter by course, year and session.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {SESSIONS.map(({ session, label }) => (
          <li key={session}>
            <Link
              href={examsHref({ session, page: 1 })}
              className="inline-flex min-h-11 items-center rounded-full bg-primary-foreground px-4 text-[0.9375rem] font-medium text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Questions() {
  return (
    <section>
      <SectionTitle>Questions</SectionTitle>
      <div className="rounded-lg border bg-card">
        {QUESTIONS.map(({ q, a }, i) => (
          <details key={q} open={i === 0} className="group border-t px-[18px] first:border-t-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-heading focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden className="text-xl leading-none text-muted-foreground group-open:hidden">
                +
              </span>
              <span aria-hidden className="hidden text-xl leading-none text-muted-foreground group-open:inline">
                &minus;
              </span>
            </summary>
            <p className="max-w-[65ch] pb-4 text-[0.9375rem]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
