"use client";

import { useEffect } from "react";
import type { ResourceType } from "@/db/constants";
import { writeLastRead } from "./reader-position";

// Remembers in this browser that this file was opened, so Home can offer "Continue where you left off".
// A place to continue from only: opening a file is never progress. Renders nothing.
export function RememberLastRead({
  id,
  title,
  courseCode,
  type,
}: {
  id: string;
  title: string;
  courseCode: string;
  type: ResourceType;
}) {
  useEffect(() => {
    writeLastRead({ id, title, courseCode, type, at: new Date().toISOString() });
  }, [id, title, courseCode, type]);
  return null;
}
