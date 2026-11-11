"use client";

import { useSearchParams } from "next/navigation";
import { signInReasonFor } from "@/lib/auth/sign-in-reason";

// "Sign in to see your saved files" above the sign-in form when `?next=` is one of the private
// pages; nothing for any other or no target. Render inside <Suspense> (it reads the query).
export function SignInReasonLine() {
  const reason = signInReasonFor(useSearchParams().get("next"));
  if (!reason) return null;
  return (
    <p data-testid="sign-in-reason" className="mb-5 text-sm font-medium text-heading">
      {reason}
    </p>
  );
}
