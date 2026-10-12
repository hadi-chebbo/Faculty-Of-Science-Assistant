import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageTitle } from "@/components/site/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10 md:py-16">
      <Card>
        <CardContent className="gap-0">
          <PageTitle>Sign in</PageTitle>
          <SignInForm />
        </CardContent>
      </Card>
      {/* Reads the cookie, so it streams in; the form itself is part of the static shell. */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </main>
  );
}

async function RedirectIfSignedIn() {
  const account = await getAccount(await getViewer());
  if (account) redirect("/admin");
  return null;
}
