"use client";

import { useEffect, useState } from "react";
import { requestWithRenew, useViewerStatus } from "@/lib/completions-client";
import type { ProgressOverview } from "@/services/progress/types";

// A signed-in student's progress over all their courses, loaded by the browser after the page shows
// (`GET /api/v1/progress`). Everything on one page shares one request; the entry is dropped when
// the last user goes away, so the next visit asks again. Visitors make no request.

let entry: { users: number; promise: Promise<ProgressOverview | null> } | null = null;

function acquire() {
  if (!entry) {
    const promise = requestWithRenew(() => fetch("/api/v1/progress", { cache: "no-store" }))
      .then(async (response) => (response.ok ? ((await response.json()) as ProgressOverview) : null))
      .catch(() => null);
    entry = { users: 0, promise };
  }
  entry.users++;
  return entry;
}

function release(own: NonNullable<typeof entry>) {
  own.users--;
  if (own.users === 0 && entry === own) entry = null;
}

export type OverviewState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: ProgressOverview }
  // A visitor, a failed request or an account with nothing to show: the answer is known and empty.
  | { status: "none"; data: null };

const LOADING: OverviewState = { status: "loading", data: null };
const NONE: OverviewState = { status: "none", data: null };

// Tells "still loading" from "nothing to show".
export function useProgressOverviewState(): OverviewState {
  const viewer = useViewerStatus();
  const signedIn = viewer === "signed-in" || viewer === "ready";
  const [answer, setAnswer] = useState<ProgressOverview | null | undefined>(undefined);
  useEffect(() => {
    if (!signedIn) return;
    const own = acquire();
    let current = true;
    void own.promise.then((result) => {
      if (current) setAnswer(result);
    });
    return () => {
      current = false;
      release(own);
    };
  }, [signedIn]);
  if (viewer === "signed-out") return NONE;
  if (!signedIn) return LOADING;
  if (answer === undefined) return LOADING;
  return answer ? { status: "ready", data: answer } : NONE;
}

// null until loaded, and for a visitor or a failed request.
export function useProgressOverview(): ProgressOverview | null {
  return useProgressOverviewState().data;
}
