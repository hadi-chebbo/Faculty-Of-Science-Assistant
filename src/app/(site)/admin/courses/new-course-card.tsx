"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "./course-form";

export const CODE_HINT = "Letters and digits, e.g. I3301. Spaces are removed.";

export function NewCourseCard() {
  const codeRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New course</CardTitle>
      </CardHeader>
      <CardContent>
        <CourseForm
          idPrefix="new-course"
          initial={{ code: "", title: "", semester: "3" }}
          url="/api/v1/courses"
          method="POST"
          submitLabel="Add course"
          savedMessage="Course added."
          clearOnSuccess
          onSaved={() => codeRef.current?.focus()}
          codeRef={codeRef}
          codeHint={CODE_HINT}
        />
      </CardContent>
    </Card>
  );
}
