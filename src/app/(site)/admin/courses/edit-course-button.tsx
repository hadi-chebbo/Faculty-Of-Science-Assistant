"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AdminCourse } from "@/services/courses/types";
import { CourseForm } from "./course-form";

// Opens the edit dialog. Radix gives focus back to this button when the dialog closes.
export function EditCourseButton({ course }: { course: AdminCourse }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9 md:px-3" aria-label={`Edit ${course.code}`}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {course.code}</DialogTitle>
          <DialogDescription>Change the code, title or semester of this course.</DialogDescription>
        </DialogHeader>
        <EditFields course={course} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditFields({ course, onSaved }: { course: AdminCourse; onSaved: () => void }) {
  return (
    <div className="[&_form]:md:grid-cols-1 [&_form>div:last-child]:md:mt-0">
      <CourseForm
        idPrefix={`edit-${course.id}`}
        initial={{ code: course.code, title: course.title, semester: String(course.semester) }}
        url={`/api/v1/courses/${course.id}`}
        method="PATCH"
        submitLabel="Save"
        savedMessage="Course saved."
        onSaved={onSaved}
        codeHint="Changing the code changes the course's address (/courses/CODE)."
      />
    </div>
  );
}
