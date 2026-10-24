import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandPanel } from "@/components/auth/brand-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { PageTitle } from "@/components/site/page-title";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

export default function SignUpPage() {
  return (
    <main>
      <AuthShell panel={<BrandPanel />}>
        <PageTitle description="Free. Confirm your email to start.">Create your account</PageTitle>
        <SignUpForm />
        <p className="mt-6 text-sm">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-md font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Sign in
          </Link>
        </p>
      </AuthShell>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </main>
  );
}
