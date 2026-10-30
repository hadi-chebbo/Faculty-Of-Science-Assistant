"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/lib/admin-fetch";

// Deletes the account after the admin types its email. `backHref` is the users list the admin returns to.
export function DeleteAccountButton({ userId, email, backHref }: { userId: string; email: string; backHref: string }) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");
  // Emails are stored lowercase, so the comparison ignores case.
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function change(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setTyped("");
  }

  async function onConfirm() {
    if (!matches) return;
    setPending(true);
    try {
      const response = await adminFetch(
        `/api/v1/users/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        toast.success("Account deleted.");
        router.replace(backHref);
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
    setTyped("");
    toast.error("Couldn't delete the account. Try again.");
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)} className="min-h-11 md:min-h-0">
        Delete account
      </Button>
      <AlertDialog open={open} onOpenChange={change}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">Delete {email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the account and everything that belongs to it. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Type the email to confirm</Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              className="min-h-11 md:min-h-0"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: the dialog stays open until the request ends. */}
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={!matches || pending}
              className="min-h-11 md:min-h-0"
            >
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
