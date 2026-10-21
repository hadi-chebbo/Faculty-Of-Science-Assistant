import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PageTitle } from "@/components/site/page-title";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const PANEL_POINTS = ["Course material by chapter", "Previous exams", "A reader for every file"];

export default function SignInPage() {
  return (
    <main>
      <AuthShell
        panel={
          <>
            <p className="text-xl font-semibold tracking-tight">University Assistant</p>
            <p className="mt-6 text-balance text-2xl font-bold leading-tight">
              Every course, chapter and past exam in one place.
            </p>
            <ul className="mt-8 space-y-3 text-[0.9375rem]">
              {PANEL_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2.5">
                  <Check className="size-4 shrink-0" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </>
        }
      >
        <PageTitle description="Sign in to continue.">Welcome back</PageTitle>
        <SignInForm />
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to courses
        </Link>
      </AuthShell>
      {/* Reads the cookie, so it streams in; the form itself is part of the static shell. */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </main>
  );
}

async function RedirectIfSignedIn() {
  const account = await getAccount(await getViewer());
  if (account) redirect(account.role === "admin" ? "/admin" : "/");
  return null;
}
