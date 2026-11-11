import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { SavedSkeleton } from "@/components/site/skeletons";
import { SignedOutState } from "@/components/site/signed-out-state";
import { getSignedInPageViewer } from "@/lib/auth/page-guard";
import { listSavedResources } from "@/services/saved/saved";
import { SavedList } from "./saved-list";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

// Private: the list belongs to the signed-in user. Everything that reads the session happens inside
// Suspense, at request time, and the response is sent no-store (next.config.ts). Without a valid
// session the page shows the in-page sign-in state (no personal data) instead of redirecting.
export default function SavedPage() {
  return (
    <main className="page-container py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Saved" }]} />
      <PageTitle>Saved</PageTitle>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedContent />
      </Suspense>
    </main>
  );
}

async function SavedContent() {
  const session = await getSignedInPageViewer();
  if (!session) return <SignedOutState page="saved" />;
  const { viewer } = session;
  const groups = await listSavedResources(viewer);
  return <SavedList groups={groups} />;
}
