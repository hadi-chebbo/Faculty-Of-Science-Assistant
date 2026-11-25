import { Suspense } from "react";
import { YearCardsSkeleton } from "@/components/site/skeletons";
import { Hero } from "./home/hero";
import { ProgressBand } from "./home/progress-band";
import { RecentAndExams } from "./home/recent";
import { YearCards } from "./home/year-cards";

// Everything is static except the year cards and the recent files, which read the database inside one Suspense boundary.
// The signed-in progress band is the one personal part (loaded by the browser, see ProgressBand).
export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container flex flex-col gap-10 py-6 md:gap-12 md:py-8">
      <Hero />
      <ProgressBand />
      <Suspense fallback={<YearCardsSkeleton />}>
        <YearCards />
        <RecentAndExams />
      </Suspense>
    </main>
  );
}
