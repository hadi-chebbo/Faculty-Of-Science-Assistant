"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AdminLecturer, SavedLecturer } from "@/services/lecturers/types";
import { LecturerForm } from "./lecturer-form";

// A rename can move the row (the list is ordered by name), and the button Radix would focus may be
// gone. The button takes the focus once the refreshed list arrives, as on the courses page.
let focusAfterRename: string | null = null;

// Opens the rename dialog. Radix gives focus back to this button when the dialog closes.
export function EditLecturerButton({ lecturer }: { lecturer: AdminLecturer }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusAfterRename !== lecturer.id) return;
    focusAfterRename = null;
    buttonRef.current?.focus();
  }, [lecturer.id, lecturer.name]);

  function onSaved(saved: SavedLecturer) {
    if (saved.name !== lecturer.name) focusAfterRename = lecturer.id;
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button ref={buttonRef} type="button" variant="outline" className="h-11 px-4 md:h-9 md:px-3" aria-label={`Edit ${lecturer.name}`}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {lecturer.name}</DialogTitle>
          <DialogDescription>Change the name students see.</DialogDescription>
        </DialogHeader>
        <LecturerForm
          idPrefix={`edit-${lecturer.id}`}
          initialName={lecturer.name}
          url={`/api/v1/lecturers/${lecturer.id}`}
          method="PATCH"
          submitLabel="Save"
          savedMessage="Lecturer saved."
          onSaved={onSaved}
          nameHint={`Renaming keeps the lecturer's address (?lecturer=${lecturer.slug}).`}
          stacked
        />
      </DialogContent>
    </Dialog>
  );
}
