import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandPanel } from "@/components/auth/brand-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { PageTitle } from "@/components/site/page-title";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function SignInPage() {
  return (
    <main>
      <AuthShell panel={<BrandPanel />}>
        <PageTitle description="Sign in to continue.">Welcome back</PageTitle>
        <SignInForm />
        <p className="mt-6 text-sm">
          New here?{" "}
          <Link href="/sign-up" className={linkClass}>
            Create an account
          </Link>
        </p>
        <Link href="/" className={`mt-2 ${linkClass}`}>
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
