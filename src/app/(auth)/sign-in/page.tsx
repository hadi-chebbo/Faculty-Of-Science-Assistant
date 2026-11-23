import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackToCourses } from "@/components/auth/back-to-courses";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandPanel } from "@/components/auth/brand-panel";
import { SignInReasonLine } from "@/components/auth/sign-in-reason-line";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { PageTitle } from "@/components/site/page-title";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <>
      <AuthShell panel={<BrandPanel />}>
        <PageTitle description="Sign in to continue.">Welcome back</PageTitle>
        <Suspense fallback={null}>
          <SignInReasonLine />
        </Suspense>
        <SignInForm />
        <p className="mt-6 text-sm">
          New here?{" "}
          <Link href="/sign-up" className={linkClass}>
            Create an account
          </Link>
        </p>
        <BackToCourses className="mt-2" />
      </AuthShell>
      {/* Reads the cookie, so it streams in; the form itself is part of the static shell. */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
    </>
  );
}
