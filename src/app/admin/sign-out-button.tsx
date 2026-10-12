"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/v1/auth/sign-out", { method: "POST" });
    } finally {
      // Navigate even if the request failed: the sign-in page shows the real state.
      router.replace("/sign-in");
    }
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={pending} className="h-11 md:h-9">
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
