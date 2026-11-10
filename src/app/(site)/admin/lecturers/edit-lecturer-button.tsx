"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AdminLecturer } from "@/services/lecturers/types";
import { LecturerForm } from "./lecturer-form";

// Opens the rename dialog. Radix gives focus back to this button when the dialog closes (the row
// does not move: the list is ordered by name, and the button stays mounted by its key).
export function EditLecturerButton({ lecturer }: { lecturer: AdminLecturer }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9 md:px-3" aria-label={`Edit ${lecturer.name}`}>
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
          onSaved={() => setOpen(false)}
          nameHint={`Renaming keeps the lecturer's address (?lecturer=${lecturer.slug}).`}
          stacked
        />
      </DialogContent>
    </Dialog>
  );
}
