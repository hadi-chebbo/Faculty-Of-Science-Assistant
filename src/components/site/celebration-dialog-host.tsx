"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { celebrationDialog } from "@/lib/celebrations";

// Brand colours for the confetti: primary, bright blue, the decorative yellow, success green.
const COLOURS = ["var(--primary)", "#5473ff", "var(--highlight)", "var(--success)"];
const PIECES = Array.from({ length: 12 }, (_, i) => ({
  x: `${6 + i * 8}%`,
  d: `${(i % 4) * 90}ms`,
  r: `${(i % 2 ? 1 : -1) * (240 + i * 25)}deg`,
  c: COLOURS[i % COLOURS.length],
}));

// The one "course finished" dialog, mounted once in SiteChrome and opened by `celebrate`.
export function CelebrationDialogHost() {
  const state = useSyncExternalStore(celebrationDialog.subscribe, celebrationDialog.get, () => null);
  const close = () => celebrationDialog.set(null);
  // Kept while the dialog is open; nothing renders without a state.
  const course = state?.course;
  const exams = course && course.exams.total > 0 ? ` Exams: ${course.exams.done} of ${course.exams.total} done.` : "";
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && close()}>
      {state && course && (
        <DialogPortal>
          {/* Above the dim layer so it stays crisp, below nothing it needs: it never takes a click. */}
          <div aria-hidden className="confetti pointer-events-none fixed inset-0 z-[51] overflow-hidden">
            {PIECES.map((piece, i) => (
              <span key={i} className="confetti-piece" style={{ "--x": piece.x, "--d": piece.d, "--r": piece.r, "--c": piece.c } as React.CSSProperties} />
            ))}
          </div>
          <DialogContent
            showCloseButton={false}
            className="items-center text-center sm:max-w-sm"
            onCloseAutoFocus={(event) => {
              const target = state.focusTarget();
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}
          >
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="size-8" aria-hidden />
            </span>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-heading">{course.code} finished</DialogTitle>
              <DialogDescription>
                You marked all {course.filesTotal} files of {course.title} as done.{exams}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button asChild className="min-h-11 flex-1 md:min-h-9">
                <Link href="/progress" onClick={close}>See your progress</Link>
              </Button>
              <Button variant="outline" className="min-h-11 flex-1 md:min-h-9" onClick={close}>
                Close
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      )}
    </Dialog>
  );
}
