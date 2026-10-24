import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandPanel } from "@/components/auth/brand-panel";
import { ConfirmEmail } from "./confirm-email";

// The token is in the URL, so the address must not leak through a Referer header.
export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmEmailPage() {
  return (
    <>
      <AuthShell panel={<BrandPanel />}>
        <ConfirmEmail />
      </AuthShell>
    </>
  );
}
