"use client";

import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddToTodo } from "@/lib/add-to-todo";

// The "add to to-do" icon on a Saved page row, beside the bookmark.
export function AddToTodoIconButton({ resourceId, title }: { resourceId: string; title: string }) {
  const { pending, add } = useAddToTodo(resourceId);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Add ${title} to to-do`}
      disabled={pending}
      onClick={() => void add()}
      className="size-11 md:size-9"
    >
      <ListPlus aria-hidden className="size-5 text-muted-foreground" />
    </Button>
  );
}
