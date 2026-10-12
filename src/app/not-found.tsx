import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <StateBlock
        icon={FileQuestion}
        title="Page not found"
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href="/">Back to home</Link>
          </Button>
        }
      >
        The page you are looking for does not exist or has moved.
      </StateBlock>
    </main>
  );
}
