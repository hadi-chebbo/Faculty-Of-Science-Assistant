"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TYPE_ICONS } from "@/components/site/resource-row";
import { Button } from "@/components/ui/button";
import { renew } from "@/lib/auth/client-session";
import type { SavedCourseGroup } from "@/services/saved/saved";
import type { LinkedFile } from "@/services/todos/types";

// The part of a file a card needs to show it (the same shape the server sends in `card.resource`).
export type PickedFile = Extract<LinkedFile, { available: true }>;

export const PICKER_EMPTY = "Nothing saved yet. Tap the bookmark on any file to save it, then link it here.";
export const PICKER_ERROR = "Couldn't load your saved files.";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; groups: SavedCourseGroup[] };

async function loadSaved(): Promise<Response> {
  const first = await fetch("/api/v1/saved");
  return first.status === 401 && (await renew()) ? fetch("/api/v1/saved") : first;
}

// An inline list of the student's saved files, opened under the button that asked for it (the card
// view and the composer share it). Loaded when it first opens. Choosing a file calls `onPick`;
// Cancel or Esc calls `onClose` (the owner puts the focus back on its button). Esc closes only the
// picker: the card view's own Esc handling is told to stand down while a picker is on screen
// (`data-saved-picker`).
export function SavedFilePicker({ onPick, onClose }: { onPick: (file: PickedFile) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSaved()
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          router.push(`/sign-in?next=${encodeURIComponent("/todo")}`);
        } else if (response.ok) {
          const { courses } = (await response.json()) as { courses: SavedCourseGroup[] };
          if (!cancelled) setState({ status: "ready", groups: courses });
        } else {
          setState({ status: "error" });
        }
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div data-saved-picker role="group" aria-label="Your saved files" className="mt-2 rounded-xl border bg-card p-2 text-left">
      <div className="flex items-center justify-between gap-2 px-1">
        <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your saved files</h5>
        <Button type="button" variant="ghost" size="sm" className="h-11 md:h-8" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {state.status === "loading" && (
          <p role="status" className="px-1 py-3 text-sm text-muted-foreground">
            Loading your saved files…
          </p>
        )}
        {state.status === "error" && (
          <div className="flex flex-col items-start gap-2 px-1 py-3">
            <p role="alert" className="text-sm text-destructive">
              {PICKER_ERROR}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 md:h-8"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {state.status === "ready" && state.groups.length === 0 && <p className="px-1 py-3 text-sm text-muted-foreground">{PICKER_EMPTY}</p>}
        {state.status === "ready" &&
          state.groups.map((group) => (
            <div key={group.courseId} className="py-1">
              <h6 className="px-1 py-1 text-xs text-muted-foreground">
                <span className="font-mono text-link">{group.courseCode}</span> {group.courseTitle}
              </h6>
              <ul>
                {group.items.map((item) => {
                  const Icon = TYPE_ICONS[item.type];
                  return (
                    <li key={item.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full justify-start gap-2 px-2 md:h-9"
                        onClick={() => onPick({ available: true, id: item.id, title: item.title, type: item.type, courseCode: item.courseCode })}
                      >
                        <Icon className="size-4 shrink-0 text-link" aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
