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
import type { AdminLecturer } from "@/services/lecturers/types";

// Deletes an unused lecturer. When the server says files still use it (409), the dialog stays
// open, says how many and the confirm button stays disabled.
export function DeleteLecturerButton({ lecturer }: { lecturer: AdminLecturer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [inUse, setInUse] = useState<number | null>(null);

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setInUse(null);
  }

  async function onConfirm() {
    setPending(true);
    try {
      const response = await adminFetch(
        `/api/v1/lecturers/${encodeURIComponent(lecturer.id)}`,
        { method: "DELETE" },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        toast.success("Lecturer deleted.");
        setOpen(false);
        router.refresh();
        return;
      }
      if (response.status === 409) {
        const data: { fileCount?: unknown } = await response.json().catch(() => ({}));
        setInUse(typeof data.fileCount === "number" ? data.fileCount : lecturer.fileCount);
        return;
      }
      if (response.status === 404) {
        toast.error("This lecturer no longer exists.");
        setOpen(false);
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
    toast.error("Couldn't delete the lecturer. Try again.");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 px-4 md:h-9 md:px-3"
        aria-label={`Delete ${lecturer.name}`}
      >
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete {lecturer.name}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {inUse !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {lecturer.name} is used by {inUse} {inUse === 1 ? "file" : "files"}. Change or clear their lecturer first.
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: the dialog stays open until the request ends. */}
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={pending || inUse !== null}
              className="min-h-11 md:min-h-0"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
