import { Suspense } from "react";
import { StatsAndSemestersSkeleton } from "@/components/site/skeletons";
import { Hero } from "./home/hero";
import { ExamBand, HowItWorks, Questions, WhatYouWillFind } from "./home/sections";
import { ProgressBand } from "./home/progress-band";
import { StatsAndSemesters } from "./home/stats-and-semesters";

// Everything is static except the numbers strip and the semester cards, which read the database
// inside one Suspense boundary (one service call feeds both).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-6 md:gap-14 md:py-8">
      <Hero />
      <ProgressBand />
      <Suspense fallback={<StatsAndSemestersSkeleton />}>
        <StatsAndSemesters />
      </Suspense>
      <HowItWorks />
      <WhatYouWillFind />
      <ExamBand />
      <Questions />
    </main>
  );
}
