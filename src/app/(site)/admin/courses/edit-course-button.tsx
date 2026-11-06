"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AdminCourse } from "@/services/courses/types";
import { CourseForm, type SavedCourseValues } from "./course-form";

// A course whose new code or semester moves its row: the row is rendered again elsewhere, so the
// button Radix would focus is gone. The new button takes the focus once the refreshed list arrives.
let focusAfterMove: string | null = null;

// Opens the edit dialog. Radix gives focus back to this button when the dialog closes.
export function EditCourseButton({ course }: { course: AdminCourse }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusAfterMove !== course.id) return;
    focusAfterMove = null;
    buttonRef.current?.focus();
  }, [course.id, course.code, course.semester]);

  function onSaved(saved: SavedCourseValues) {
    if (saved.code !== course.code || saved.semester !== course.semester) focusAfterMove = course.id;
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button ref={buttonRef} type="button" variant="outline" className="h-11 px-4 md:h-9 md:px-3" aria-label={`Edit ${course.code}`}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {course.code}</DialogTitle>
          <DialogDescription>Change the code, title or semester of this course.</DialogDescription>
        </DialogHeader>
        <EditFields course={course} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function EditFields({ course, onSaved }: { course: AdminCourse; onSaved: (saved: SavedCourseValues) => void }) {
  return (
    <CourseForm
      idPrefix={`edit-${course.id}`}
      initial={{ code: course.code, title: course.title, semester: String(course.semester) }}
      url={`/api/v1/courses/${course.id}`}
      method="PATCH"
      submitLabel="Save"
      savedMessage="Course saved."
      onSaved={onSaved}
      codeHint="Changing the code changes the course's address (/courses/CODE)."
      stacked
    />
  );
}
