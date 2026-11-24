import { Suspense } from "react";
import { StatsAndYearsSkeleton } from "@/components/site/skeletons";
import { Hero } from "./home/hero";
import { ExamBand, HowItWorks, Questions, WhatYouWillFind } from "./home/sections";
import { ProgressBand } from "./home/progress-band";
import { StatsAndYears } from "./home/stats-and-years";

// Everything is static except the numbers strip and the year cards, which read the database
// inside one Suspense boundary (one service call feeds both).
export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-12 py-6 md:gap-14 md:py-8">
      <Hero />
      <ProgressBand />
      <Suspense fallback={<StatsAndYearsSkeleton />}>
        <StatsAndYears />
      </Suspense>
      <div className="home-rest flex flex-col gap-12 md:gap-14">
        <HowItWorks />
        <WhatYouWillFind />
        <ExamBand />
        <Questions />
      </div>
    </main>
  );
}
