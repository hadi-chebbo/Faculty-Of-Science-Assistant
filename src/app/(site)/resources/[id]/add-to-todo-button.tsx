"use client";

import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddToTodo } from "@/lib/add-to-todo";

// "Add to to-do" under the Save button in the details column: a new card in To do linked to this
// file. Signed out, it goes to sign-in and back, like Save.
export function AddToTodoButton({ resourceId }: { resourceId: string }) {
  const { pending, add } = useAddToTodo(resourceId);
  return (
    <Button type="button" variant="outline" disabled={pending} onClick={() => void add()} className="min-h-11 w-full md:min-h-9">
      <ListPlus aria-hidden />
      Add to to-do
    </Button>
  );
}
