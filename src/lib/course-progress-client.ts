"use client";

import { useEffect, useState } from "react";
import { requestWithRenew, useKnownSignedIn } from "@/lib/completions-client";
import type { CourseProgress } from "@/services/progress/types";

// A signed-in student's progress in one course, loaded by the browser after the page shows
// (`GET /api/v1/progress/courses/CODE`). The header block and the chapter cards share one request
// per page load; the entry is dropped when the last of them goes away, so the next visit asks
// again. Visitors make no request. Signing in or out resets the completions store, which changes
// `signedIn` here and so reloads or clears the answer.

type Entry = { users: number; promise: Promise<CourseProgress | null> };
const entries = new Map<string, Entry>();

function acquire(code: string): Entry {
  let entry = entries.get(code);
  if (!entry) {
    const promise = requestWithRenew(() => fetch(`/api/v1/progress/courses/${encodeURIComponent(code)}`, { cache: "no-store" }))
      .then(async (response) => (response.ok ? ((await response.json()) as CourseProgress) : null))
      .catch(() => null);
    entry = { users: 0, promise };
    entries.set(code, entry);
  }
  entry.users++;
  return entry;
}

function release(code: string, entry: Entry): void {
  entry.users--;
  if (entry.users === 0 && entries.get(code) === entry) entries.delete(code);
}

// null until loaded, and for a visitor or a failed request.
export function useCourseProgress(code: string): CourseProgress | null {
  const signedIn = useKnownSignedIn();
  const [loaded, setLoaded] = useState<{ code: string; data: CourseProgress } | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    const entry = acquire(code);
    let current = true;
    void entry.promise.then((data) => {
      if (current && data) setLoaded({ code, data });
    });
    return () => {
      current = false;
      release(code, entry);
    };
  }, [code, signedIn]);
  return signedIn && loaded?.code === code ? loaded.data : null;
}
