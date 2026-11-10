"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type Ref } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LECTURER_NAME_MAX_LENGTH } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";
import { useHydrated } from "@/lib/use-hydrated";

const NAME_MESSAGE = `Enter a name of 1 to ${LECTURER_NAME_MAX_LENGTH} characters.`;
const TAKEN_MESSAGE = "A lecturer with this name already exists.";

// The lecturer as the server stored it.
export interface SavedLecturerValues {
  id: string;
  name: string;
  slug: string;
}

// The Name field with its save request. Used for a new lecturer (POST) and for the edit dialog
// (PATCH). A field error from the server shows under the field; the typed value is kept.
export function LecturerForm({
  idPrefix,
  initialName,
  url,
  method,
  submitLabel,
  savedMessage,
  clearOnSuccess,
  onSaved,
  nameRef,
  nameHint,
  stacked,
}: {
  idPrefix: string;
  initialName: string;
  url: string;
  method: "POST" | "PATCH";
  submitLabel: string;
  savedMessage: string;
  clearOnSuccess?: boolean;
  onSaved?: (lecturer: SavedLecturerValues) => void;
  nameRef?: Ref<HTMLInputElement>;
  nameHint: string;
  // One field per line (the edit dialog); otherwise the button sits beside the field from md up.
  stacked?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await adminFetch(
        url,
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        const { lecturer }: { lecturer: SavedLecturerValues } = await response.json();
        toast.success(savedMessage);
        if (clearOnSuccess) setName(initialName);
        router.refresh();
        onSaved?.(lecturer);
        return;
      }
      if (response.status === 401) {
        toast.error("Your session has ended. Redirecting to sign in.");
      } else if (response.status === 409) {
        setError(TAKEN_MESSAGE);
      } else if (response.status === 400) {
        const data: { fields?: unknown } = await response.json().catch(() => ({}));
        if (Array.isArray(data.fields) && data.fields.includes("name")) setError(NAME_MESSAGE);
        else toast.error("Something went wrong. Please try again.");
      } else if (response.status === 404) {
        toast.error("This lecturer no longer exists.");
        router.refresh();
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className={stacked ? "grid gap-4" : "grid gap-4 md:grid-cols-[1fr_auto] md:items-start"}
    >
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="mb-1.5">Name</Label>
        <Input
          id={`${idPrefix}-name`}
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LECTURER_NAME_MAX_LENGTH + 20}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${idPrefix}-name-hint${error ? ` ${idPrefix}-name-error` : ""}`}
          className="h-11 md:h-9"
        />
        <p id={`${idPrefix}-name-hint`} className="mt-1.5 text-xs text-muted-foreground">{nameHint}</p>
        {error ? (
          <p id={`${idPrefix}-name-error`} className="mt-1.5 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending || !hydrated} className={stacked ? "h-11 px-4 md:h-9 md:px-3" : "h-11 px-4 md:mt-[1.625rem] md:h-9 md:px-3"}>
        {submitLabel}
      </Button>
    </form>
  );
}
