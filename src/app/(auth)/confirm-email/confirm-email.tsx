"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResendLink } from "@/components/auth/resend-link";
import { PageTitle } from "@/components/site/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clearSignupEmail } from "@/lib/auth/signup-storage";

type State = "confirming" | "confirmed" | "invalid" | "network";

// The token is used only here, from the browser: a mail scanner that fetches the URL gets this
// HTML but never runs the script, so it cannot use the link up.
export function ConfirmEmail() {
  const [state, setState] = useState<State>("confirming");
  const token = useRef<string | null>(null);
  const started = useRef(false);

  const confirm = useCallback(async () => {
    if (!token.current) {
      setState("invalid");
      return;
    }
    setState("confirming");
    try {
      const response = await fetch("/api/v1/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
      });
      if (response.ok) {
        clearSignupEmail();
        setState("confirmed");
      } else if (response.status === 400) setState("invalid");
      else setState("network");
    } catch {
      setState("network");
    }
  }, []);

  useEffect(() => {
    // Strict mode runs effects twice in development; the token may only be sent once.
    if (started.current) return;
    started.current = true;
    token.current = new URLSearchParams(window.location.search).get("token");
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void confirm();
  }, [confirm]);

  if (state === "confirming") {
    return (
      <div aria-busy="true" role="status" className="flex items-center gap-2.5 py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        Confirming your email...
      </div>
    );
  }

  if (state === "confirmed") {
    return (
      <>
        <PageTitle description="Your account is ready. Sign in to continue.">Email confirmed</PageTitle>
        <Button asChild className="h-11 w-full text-base">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </>
    );
  }

  if (state === "network") {
    return (
      <>
        <PageTitle>Could not confirm</PageTitle>
        <Alert variant="destructive" className="mb-5">
          <AlertCircle aria-hidden />
          <AlertDescription className="font-medium text-destructive">
            Could not reach the server. Check your connection and try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => void confirm()} className="h-11 w-full text-base">
          Try again
        </Button>
      </>
    );
  }

  return (
    <>
      <PageTitle description="It may have expired (links last 24 hours) or already been used. If you already confirmed, just sign in.">
        This link can&apos;t be used
      </PageTitle>
      <ResendLink email={null} waitOnArrival={false} />
      <Link
        href="/sign-in"
        className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Sign in
      </Link>
    </>
  );
}
