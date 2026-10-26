import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { SavedSkeleton } from "@/components/site/skeletons";
import { requireSignedInPage } from "@/lib/auth/page-guard";
import { listSavedResources } from "@/services/saved/saved";
import { SavedList } from "./saved-list";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

// Private: the list belongs to the signed-in user. Everything that reads the session happens inside
// Suspense, at request time, and the response is sent no-store (next.config.ts). Nothing renders
// before the guard: without a valid session the visitor goes through the restore route to sign-in.
export default function SavedPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Saved" }]} />
      <PageTitle>Saved</PageTitle>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedContent />
      </Suspense>
    </main>
  );
}

async function SavedContent() {
  const { viewer } = await requireSignedInPage("/saved");
  const groups = await listSavedResources(viewer);
  return <SavedList groups={groups} />;
}
