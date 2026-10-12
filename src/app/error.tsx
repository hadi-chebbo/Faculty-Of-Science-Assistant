"use client";

import { TriangleAlert } from "lucide-react";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";

// Shown for any unexpected failure. Deliberately shows no error details.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <StateBlock
        icon={TriangleAlert}
        title="Something went wrong"
        actions={
          <Button className="h-11 md:h-9" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        Something went wrong on our side. Please try again.
      </StateBlock>
    </main>
  );
}
