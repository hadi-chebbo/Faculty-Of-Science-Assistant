import { Suspense } from "react";
import { StatsAndYearsSkeleton } from "@/components/site/skeletons";
import { Hero } from "./home/hero";
import { ExamBand, HowItWorks, Questions, WhatYouWillFind } from "./home/sections";
import { ProgressBand } from "./home/progress-band";
import { PrototypeSwitcher } from "./home/prototype/switcher";
import { VariantE } from "./home/prototype/variant-e";
import { StatsAndYears } from "./home/stats-and-years";

// PROTOTYPE: ?variant=E swaps the whole page; no variant is the current home. Remove before merging.
export default async function Home({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
  const { variant } = await searchParams;
  const proto =
    variant === "E" ? <VariantE /> : null;
  if (proto) {
    return (
      <>
        {proto}
        <Suspense>
          <PrototypeSwitcher />
        </Suspense>
      </>
    );
  }
  return (
    <>
      <Current />
      <Suspense>
        <PrototypeSwitcher />
      </Suspense>
    </>
  );
}

function Current() {
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
