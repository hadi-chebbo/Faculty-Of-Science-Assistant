import fs from "node:fs/promises";
import type { Mailer } from "./types";

// Development, tests and CI only (config refuses it on Vercel). With a file, appends one JSON
// line per email (tests read links from it); without one, prints the recipient and subject only.
export function createLogMailer(logFile?: string, now: () => Date = () => new Date()): Mailer {
  return {
    async send({ to, subject, text, html }) {
      if (logFile) {
        await fs.appendFile(logFile, JSON.stringify({ to, subject, text, html, time: now().toISOString() }) + "\n");
      } else {
        console.log(`[mail] to=${to} subject=${subject}`);
      }
    },
  };
}
