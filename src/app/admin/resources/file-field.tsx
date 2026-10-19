"use client";

import { FileText, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { UploadError, checkPdfFile, formatFileSize, uploadPdf } from "@/lib/upload-file";

type Picked = { name: string; size: number };

// The PDF of a resource. A chosen file uploads at once; `ticket` (kept by the form) is set when the
// upload is done and is sent with the save. Without a ticket the stored file, if any, stays as it is.
export function FileField({
  id,
  ticket,
  onTicketChange,
  onUploadingChange,
  storedFileHref,
  serverError,
  onSignedOut,
}: {
  id: string;
  ticket: string | null;
  onTicketChange: (ticket: string | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  // Set on the edit page of a resource that has a stored file.
  storedFileHref?: string;
  serverError?: string;
  onSignedOut: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? serverError;
  const errorId = `${id}-error`;

  function setBusy(value: boolean) {
    setUploading(value);
    onUploadingChange(value);
  }

  function cancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
  }

  async function start(file: File) {
    // A new choice cancels an upload in progress.
    controllerRef.current?.abort();
    setLocalError(null);
    const problem = checkPdfFile(file);
    if (problem) {
      controllerRef.current = null;
      setBusy(false);
      setLocalError(problem);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setPicked({ name: file.name, size: file.size });
    setProgress(0);
    setBusy(true);
    onTicketChange(null);
    try {
      const newTicket = await uploadPdf(file, { signal: controller.signal, onProgress: setProgress, onSignedOut });
      if (controller.signal.aborted) return;
      controllerRef.current = null;
      setBusy(false);
      onTicketChange(newTicket);
    } catch (caught) {
      // Cancelled by the admin or replaced by a newer choice: that one reports its own result.
      if (controller.signal.aborted) return;
      controllerRef.current = null;
      setBusy(false);
      setLocalError(caught instanceof UploadError ? caught.message : "The upload failed. Try again.");
    }
  }

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) void start(file);
    // So choosing the same file again still fires a change.
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onPick(event.dataTransfer.files);
  }

  const openPicker = () => inputRef.current?.click();
  const describedBy = error ? errorId : undefined;

  let body;
  if (uploading && picked) {
    body = (
      <div className="space-y-3">
        <FileLine picked={picked} />
        <div className="flex items-center gap-3">
          <Progress value={progress} aria-label="Upload progress" className="h-2" />
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={cancel}>
          Cancel
        </Button>
      </div>
    );
  } else if (ticket !== null && picked) {
    body = (
      <div className="space-y-3">
        <FileLine picked={picked} />
        <p className="text-sm text-foreground">Ready. It is saved with the resource.</p>
        {storedFileHref && <p className="text-sm text-muted-foreground">Replaces the stored file when you save.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => onTicketChange(null)}>
            Remove
          </Button>
        </div>
      </div>
    );
  } else if (storedFileHref) {
    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          A PDF is stored.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href={storedFileHref} target="_blank" rel="noopener" className="inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline md:h-9">
            View current file
          </a>
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={openPicker}>
            Replace file
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">PDF, up to 50 MB</p>
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={openPicker}>
          Choose PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>File</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onPick(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("rounded-lg border border-dashed p-4", dragging ? "border-primary bg-muted" : "border-input", error && "border-destructive")}
      >
        {body}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FileLine({ picked }: { picked: Picked }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{picked.name}</span>
      <span className="shrink-0 text-muted-foreground">{formatFileSize(picked.size)}</span>
    </p>
  );
}
