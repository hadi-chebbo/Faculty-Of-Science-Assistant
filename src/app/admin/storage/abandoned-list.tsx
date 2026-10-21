"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-fetch";

interface Row {
  key: string;
  label: string;
  size: string;
  age: string;
}

const filesText = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

// The files found by a scan, with the delete button. It sends exactly the keys shown; the server
// re-checks every one, so a file that changed since the scan is skipped and reported.
export function AbandonedList({ files, summary, totalSize }: { files: Row[]; summary: string; totalSize: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function onDelete() {
    setConfirming(false);
    setPending(true);
    setMessage(null);
    try {
      const response = await adminFetch(
        "/api/v1/storage/cleanup",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: files.map((f) => f.key) }) },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        const data: { deleted: string[]; skipped: string[] } = await response.json();
        const skipped = data.skipped.length > 0 ? ` ${data.skipped.length} skipped because they changed since the scan.` : "";
        setMessage({ text: `Deleted ${filesText(data.deleted.length)}.${skipped}`, error: false });
        router.refresh();
      } else if (response.status === 401) {
        setMessage({ text: "Your session has ended. Redirecting to sign in.", error: true });
      } else {
        setMessage({ text: "Something went wrong. Please try again.", error: true });
      }
    } catch {
      setMessage({ text: "Could not reach the server. Check your connection and try again.", error: true });
    }
    setPending(false);
  }

  return (
    <div className="space-y-4">
      {files.length === 0 ? <p>No abandoned files.</p> : <p className="font-medium text-heading">{summary}</p>}
      {message && (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm font-medium text-heading"}>
          {message.text}
        </p>
      )}
      {files.length > 0 && (
        <>
          <ul aria-label="Abandoned files" className="divide-y rounded-md border text-sm">
            {files.map((file) => (
              <li key={file.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
                <span className="font-mono text-xs" title={file.key}>{file.label}</span>
                <span className="text-muted-foreground">{file.size} · {file.age}</span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirming(true)} className="h-11 px-4 md:h-9 md:px-3">
            Delete {filesText(files.length)}
          </Button>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {filesText(files.length)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes {filesText(files.length)} ({totalSize}) from storage. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
