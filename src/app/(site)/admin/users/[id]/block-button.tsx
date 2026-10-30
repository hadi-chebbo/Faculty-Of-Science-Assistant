"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-fetch";

// Blocks or unblocks the user, each after a question. Blocking signs them out everywhere.
export function BlockButton({ userId, email, blocked }: { userId: string; email: string; blocked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const verb = blocked ? "unblock" : "block";

  async function onConfirm() {
    setPending(true);
    try {
      const response = await adminFetch(
        `/api/v1/users/${encodeURIComponent(userId)}/${verb}`,
        { method: "POST" },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        setOpen(false);
        toast.success(blocked ? "User unblocked." : "User blocked.");
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
    setOpen(false);
    toast.error(`Couldn't ${verb} the user. Try again.`);
  }

  return (
    <>
      <Button
        type="button"
        variant={blocked ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
        className="min-h-11 md:min-h-0"
      >
        {blocked ? "Unblock user" : "Block user"}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">
              {blocked ? "Unblock" : "Block"} {email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? "They can sign in again."
                : "They are signed out everywhere within 15 minutes and can't sign in until you unblock them. Their data is kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: the dialog stays open until the request ends. */}
            <Button
              type="button"
              variant={blocked ? "default" : "destructive"}
              onClick={onConfirm}
              disabled={pending}
              className="min-h-11 md:min-h-0"
            >
              {blocked ? "Unblock" : "Block"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
