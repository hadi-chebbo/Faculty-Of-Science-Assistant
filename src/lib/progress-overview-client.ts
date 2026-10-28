"use client";

import { useEffect, useState } from "react";
import { requestWithRenew, useKnownSignedIn } from "@/lib/completions-client";
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

// null until loaded, and for a visitor or a failed request.
export function useProgressOverview(): ProgressOverview | null {
  const signedIn = useKnownSignedIn();
  const [data, setData] = useState<ProgressOverview | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const own = acquire();
    let current = true;
    void own.promise.then((answer) => {
      if (current && answer) setData(answer);
    });
    return () => {
      current = false;
      release(own);
    };
  }, [signedIn]);
  return signedIn ? data : null;
}
