"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-fetch";

// Confirms the user's email by hand. Harmless to repeat, so there is no question first.
export function ConfirmEmailButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const response = await adminFetch(
        `/api/v1/users/${encodeURIComponent(userId)}/confirm-email`,
        { method: "POST" },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        toast.success("Email confirmed.");
        router.refresh();
        return;
      }
      if (response.status === 401) {
        toast.error("Your session has ended. Redirecting to sign in.");
        return;
      }
    } catch {
      // Network failure: same message as a refusal.
    } finally {
      setPending(false);
    }
    toast.error("Couldn't confirm the email. Try again.");
  }

  return (
    <Button type="button" onClick={onClick} disabled={pending} className="min-h-11 md:min-h-0">
      Confirm email
    </Button>
  );
}
