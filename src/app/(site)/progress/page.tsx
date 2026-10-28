import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { ProgressSkeleton } from "@/components/site/skeletons";
import { requireSignedInPage } from "@/lib/auth/page-guard";
import { getProgressOverview } from "@/services/progress/progress";
import { ProgressOverviewList } from "./progress-overview-list";
import { ThisWeek } from "./this-week";

export const metadata: Metadata = { title: "Your progress", robots: { index: false, follow: false } };

// Private: the figures belong to the signed-in user. Everything that reads the session happens
// inside Suspense, at request time, and the response is sent no-store (next.config.ts). Nothing
// renders before the guard: without a valid session the visitor goes through the restore route to
// sign-in.
export default function ProgressPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Progress" }]} />
      <PageTitle description="Based only on the files you marked as done.">Your progress</PageTitle>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </main>
  );
}

async function ProgressContent() {
  const { viewer } = await requireSignedInPage("/progress");
  const overview = await getProgressOverview(viewer);
  return (
    <div className="space-y-8">
      {overview.hasCompletions && (
        <div className="md:max-w-[360px]">
          <ThisWeek week={overview.week} />
        </div>
      )}
      <ProgressOverviewList courses={overview.courses} />
    </div>
  );
}
