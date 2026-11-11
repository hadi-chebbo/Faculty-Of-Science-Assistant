"use client";

import { Bookmark, ListTodo, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { renew } from "@/lib/auth/client-session";
import { announceSessionChange } from "@/lib/auth/session-events";
import { SIGN_IN_REASONS, type PrivatePage } from "@/lib/auth/sign-in-reason";

const ICONS = { saved: Bookmark, todo: ListTodo, progress: TrendingUp } as const;

// What /saved, /todo and /progress show a visitor without a session, inside the normal site
// chrome. It holds no personal data. A visitor whose access token expired but who still has a
// refresh cookie is renewed here first (once), and the page then re-renders with the real
// content, so they never see the prompt; until that is known a skeleton of the same size shows.
export function SignedOutState({ page }: { page: PrivatePage }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await renew()) {
          announceSessionChange();
          router.refresh();
          return;
        }
      } catch {
        // Offline or a server error: show the prompt.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const { path, title, line } = SIGN_IN_REASONS[page];
  const Icon = ICONS[page];

  if (checking) {
    return (
      <div data-testid="signed-out-checking" aria-hidden className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center md:py-16">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-11 w-56 max-w-full" />
      </div>
    );
  }

  return (
    <section data-testid="signed-out-state" className="mx-auto flex max-w-md flex-col items-center py-12 text-center md:py-16">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-heading">{title}</h2>
      <p className="mt-2 text-muted-foreground">{line}</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button asChild className="h-11 px-6">
          <Link href={`/sign-in?next=${encodeURIComponent(path)}`}>Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 px-6">
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Browse courses
      </Link>
    </section>
  );
}
