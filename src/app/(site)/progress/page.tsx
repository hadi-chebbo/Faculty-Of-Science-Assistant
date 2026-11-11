import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { ProgressSkeleton } from "@/components/site/skeletons";
import { SignedOutState } from "@/components/site/signed-out-state";
import { getSignedInPageViewer } from "@/lib/auth/page-guard";
import { getProgressOverview } from "@/services/progress/progress";
import { Milestones } from "./milestones";
import { ProgressOverviewList } from "./progress-overview-list";
import { ThisWeek } from "./this-week";

export const metadata: Metadata = { title: "Your progress", robots: { index: false, follow: false } };

// Private: the figures belong to the signed-in user. Everything that reads the session happens inside
// Suspense, at request time, and the response is sent no-store (next.config.ts). Without a valid
// session the page shows the in-page sign-in state (no personal data) instead of redirecting.
export default function ProgressPage() {
  return (
    <main className="page-container py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Progress" }]} />
      <PageTitle description="Based only on the files you marked as done.">Your progress</PageTitle>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </main>
  );
}

async function ProgressContent() {
  const session = await getSignedInPageViewer();
  if (!session) return <SignedOutState page="progress" />;
  const { viewer } = session;
  const overview = await getProgressOverview(viewer);
  return (
    <div className="space-y-8">
      {overview.hasCompletions && (
        <div className="grid gap-4 grid-cols-[minmax(0,1fr)] md:grid-cols-[360px_minmax(0,1fr)]">
          <ThisWeek week={overview.week} />
          <Milestones milestones={overview.milestones} />
        </div>
      )}
      <ProgressOverviewList courses={overview.courses} />
    </div>
  );
}
