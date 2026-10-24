import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandPanel } from "@/components/auth/brand-panel";
import { PageTitle } from "@/components/site/page-title";
import { CheckEmail } from "./check-email";

export const metadata: Metadata = { title: "Check your inbox", robots: { index: false, follow: false } };

export default function CheckEmailPage() {
  return (
    <>
      <AuthShell panel={<BrandPanel />}>
        <PageTitle>Check your inbox</PageTitle>
        <CheckEmail />
      </AuthShell>
    </>
  );
}
