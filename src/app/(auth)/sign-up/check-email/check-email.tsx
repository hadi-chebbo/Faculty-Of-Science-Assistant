"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ResendLink } from "@/components/auth/resend-link";
import { clearSignupEmail, SIGNUP_EMAIL_KEY } from "@/lib/auth/signup-storage";
import { maskEmail } from "@/lib/mask-email";

const subscribe = () => () => {};
// "" when nothing is stored or storage is blocked.
function readEmail(): string {
  try {
    return sessionStorage.getItem(SIGNUP_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function CheckEmail() {
  // undefined while rendering on the server and hydrating, so the text never flashes the wrong variant.
  const stored = useSyncExternalStore<string | undefined>(subscribe, readEmail, () => undefined);
  const email = stored ? stored : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="min-h-6">
          {stored === undefined
            ? null
            : email
              ? `We sent a confirmation link to ${maskEmail(email)}.`
              : "We sent a confirmation link to your email address."}
        </p>
        <p>The link expires in 24 hours. If you can&apos;t find it, check your spam folder.</p>
      </div>
      {stored !== undefined && <ResendLink email={email} waitOnArrival />}
      <Link
        href="/sign-up"
        onClick={clearSignupEmail}
        className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Wrong email? Start again
      </Link>
    </div>
  );
}
