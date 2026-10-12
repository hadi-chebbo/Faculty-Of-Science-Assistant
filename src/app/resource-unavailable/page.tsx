import { FileX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Resource unavailable", robots: { index: false, follow: false } };

// Where opening a resource lands when it cannot be opened. Static on purpose: it shows nothing
// from the request, so the redirect cannot be used to put text on our site.
export default function ResourceUnavailablePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <StateBlock
        icon={FileX}
        title="Resource unavailable"
        actions={
          <>
            <Button asChild className="h-11 md:h-9">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/exams">Browse exams</Link>
            </Button>
          </>
        }
      >
        This resource could not be opened. It may have been removed, or it is not available yet.
      </StateBlock>
    </main>
  );
}
