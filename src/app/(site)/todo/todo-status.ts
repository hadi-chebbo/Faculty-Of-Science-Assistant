import { CheckCircle2, Circle, Timer, type LucideIcon } from "lucide-react";
import type { TodoStatus } from "@/db/constants";

// How each column looks (variant D of the prototype). To do is neutral, In progress uses the
// primary colour, Done uses the success token, which is for Done only.
export const STATUS_LOOK: Record<
  TodoStatus,
  { label: string; icon: LucideIcon; bar: string; tint: string; iconTone: string; tab: string; empty: string }
> = {
  todo: {
    label: "To do",
    icon: Circle,
    bar: "bg-muted-foreground/40",
    tint: "bg-muted/80",
    iconTone: "text-muted-foreground",
    tab: "data-active:border-b-muted-foreground/60",
    empty: "Nothing planned. Add the next thing you want to study.",
  },
  in_progress: {
    label: "In progress",
    icon: Timer,
    bar: "bg-primary",
    tint: "bg-primary/[0.06]",
    iconTone: "text-link",
    tab: "data-active:border-b-primary",
    empty: "Nothing in progress. Add a card for what you are working on.",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    bar: "bg-success",
    tint: "bg-success/[0.07]",
    iconTone: "text-success",
    tab: "data-active:border-b-success",
    empty: "Finished cards land here. Enjoy it.",
  },
};
