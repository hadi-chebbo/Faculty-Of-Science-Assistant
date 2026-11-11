"use client";

import { useRouter } from "next/navigation";
import { SignInFields } from "@/components/auth/sign-in-fields";
import { safeNextPath } from "@/lib/auth/request";

export function SignInForm() {
  const router = useRouter();
  return (
    <SignInFields
      onSuccess={(role) => {
        // Stay in the loading state until the navigation replaces this page.
        // `next` is only ever used as a path here, after the same-site check; it is never rendered.
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(safeNextPath(next, role === "admin" ? "/admin" : "/"));
      }}
    />
  );
}
