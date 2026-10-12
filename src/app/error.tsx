"use client";

import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";

// Shown for any unexpected failure. Deliberately shows no error details.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <PageTitle description="Something went wrong on our side. Please try again.">Something went wrong</PageTitle>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
