"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LecturerForm } from "./lecturer-form";

export function NewLecturerCard() {
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New lecturer</CardTitle>
      </CardHeader>
      <CardContent>
        <LecturerForm
          idPrefix="new-lecturer"
          initialName=""
          url="/api/v1/lecturers"
          method="POST"
          submitLabel="Add lecturer"
          savedMessage="Lecturer added."
          clearOnSuccess
          onSaved={() => nameRef.current?.focus()}
          nameRef={nameRef}
          nameHint="As students know them, e.g. Dr. Ali Ghorayeb."
        />
      </CardContent>
    </Card>
  );
}
