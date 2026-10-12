import Link from "next/link";
import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <PageTitle description="The page you are looking for does not exist or has moved.">Page not found</PageTitle>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
