"use client";

import { FileText, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { TextLayerBadge } from "@/components/admin/text-layer-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { describeTextCheck, textLayerStatus, type TextCheck } from "@/lib/pdf-text-check";
import { checkFileTextLayer } from "@/lib/pdf-text-check-client";
import { cn } from "@/lib/utils";
import {
  MAX_SIZE_LABEL,
  SignedOutError,
  UPLOAD_FAILED_MESSAGE,
  UploadError,
  checkPdfFile,
  formatFileSize,
  uploadPdf,
} from "@/lib/upload-file";

// The name and size shown for the file being uploaded or ready to save. Never sent to the server.
type PickedFile = { name: string; size: number };

const BUTTON = "h-11 md:h-9";

// The PDF of a resource. A chosen file uploads at once; `ticket` (kept by the form) is set when the
// upload is done and is sent with the save. Without a ticket the stored file, if any, stays as it is.
// A ticket already held is kept until a new upload succeeds, so cancelling or failing a replacement
// goes back to the file that was ready before.
export function FileField({
  id,
  ticket,
  textCheck,
  onTicketChange,
  onUploadingChange,
  storedFileHref,
  storedTextCheck,
  serverError,
  onSignedOut,
}: {
  id: string;
  ticket: string | null;
  // The text check of the file behind `ticket`, or null when it could not be made.
  textCheck: TextCheck | null;
  onTicketChange: (ticket: string | null, textCheck: TextCheck | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  // Set on the edit page of a resource that has a stored file.
  storedFileHref?: string;
  // The text check of the stored file (null: not checked). Set together with `storedFileHref`.
  storedTextCheck?: TextCheck | null;
  serverError?: string;
  onSignedOut: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? serverError;
  const errorId = `${id}-error`;

  // The file that was ready before the current upload began, restored if that upload does not finish.
  const previousRef = useRef<PickedFile | null>(null);

  // Leaving the page stops an upload that is still running.
  useEffect(() => () => controllerRef.current?.abort(), []);

  function setBusy(value: boolean) {
    setUploading(value);
    onUploadingChange(value);
  }

  // Ends the current upload, if any, and goes back to what was there before it.
  function stopUpload() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (uploading) setPicked(previousRef.current);
    setBusy(false);
  }

  async function beginUpload(file: File) {
    // What to go back to if this upload does not finish: the ready file, or what the running upload
    // would have gone back to. Read before stopUpload, which changes `picked`.
    const before = uploading ? previousRef.current : ticket !== null ? picked : null;
    // A new choice cancels an upload in progress.
    stopUpload();
    setLocalError(null);
    const problem = checkPdfFile(file);
    if (problem) {
      setLocalError(problem);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    previousRef.current = before;
    setPicked({ name: file.name, size: file.size });
    setProgress(0);
    setBusy(true);
    // The text check runs beside the upload and never fails; it is only waited for once the bytes are sent.
    const check = checkFileTextLayer(file);
    try {
      const newTicket = await uploadPdf(file, { signal: controller.signal, onProgress: setProgress, onSignedOut });
      const result = await check;
      if (controller.signal.aborted) return;
      controllerRef.current = null;
      setBusy(false);
      onTicketChange(newTicket, result);
    } catch (caught) {
      // Cancelled by the admin or replaced by a newer choice: that one reports its own result.
      if (controller.signal.aborted) return;
      controllerRef.current = null;
      setPicked(previousRef.current);
      setBusy(false);
      // Signed out: the browser is already going to the sign-in page, so no message.
      if (caught instanceof SignedOutError) return;
      setLocalError(caught instanceof UploadError ? caught.message : UPLOAD_FAILED_MESSAGE);
    }
  }

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (file) void beginUpload(file);
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

  let content;
  if (uploading && picked) {
    content = (
      <div className="space-y-3">
        <FileLine picked={picked} />
        <div className="flex items-center gap-3">
          <Progress value={progress} aria-label="Upload progress" className="h-2" />
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <Button type="button" variant="outline" className={BUTTON} onClick={stopUpload}>
          Cancel
        </Button>
      </div>
    );
  } else if (ticket !== null && picked) {
    content = (
      <div className="space-y-3">
        <FileLine picked={picked} />
        <p className="text-sm text-foreground">Ready. It is saved with the resource.</p>
        {textCheck && textLayerStatus(textCheck.pageCount, textCheck.textPageCount) !== "text" && (
          <p className="text-sm text-muted-foreground" data-testid="text-check-note">
            {describeTextCheck(textCheck.pageCount, textCheck.textPageCount)}
          </p>
        )}
        {storedFileHref && <p className="text-sm text-muted-foreground">Replaces the stored file when you save.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className={BUTTON} onClick={() => onTicketChange(null, null)}>
            Remove
          </Button>
        </div>
      </div>
    );
  } else if (storedFileHref) {
    content = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          A PDF is stored.
        </p>
        {storedTextCheck !== undefined && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="stored-text-check">
            {storedTextCheck ? (
              <>
                <span>
                  Text: {storedTextCheck.textPageCount} of {storedTextCheck.pageCount} {storedTextCheck.pageCount === 1 ? "page" : "pages"}
                </span>
                <TextLayerBadge pageCount={storedTextCheck.pageCount} textPageCount={storedTextCheck.textPageCount} />
              </>
            ) : (
              "Not checked"
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <a href={storedFileHref} target="_blank" rel="noopener" className="inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline md:h-9">
            View current file
          </a>
          <Button type="button" variant="outline" className={BUTTON} onClick={openPicker} aria-describedby={describedBy}>
            Replace file
          </Button>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col items-center gap-3 text-center">
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">PDF, up to {MAX_SIZE_LABEL}</p>
        <Button type="button" variant="outline" className={BUTTON} onClick={openPicker} aria-describedby={describedBy}>
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
        // The visible button opens the picker; one tab stop for one action.
        tabIndex={-1}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onPick(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Moving over a child element also fires dragleave; only leaving the box counts.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn("rounded-lg border border-dashed p-4", dragging ? "border-primary bg-muted" : "border-input", error && "border-destructive")}
      >
        {content}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FileLine({ picked }: { picked: PickedFile }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{picked.name}</span>
      <span className="shrink-0 text-muted-foreground">{formatFileSize(picked.size)}</span>
    </p>
  );
}
