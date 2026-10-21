import { after } from "next/server";
import { processEmailJob } from "@/services/email-jobs/process";

// Schedules the job to be sent once the response has been sent (on Vercel `after` uses waitUntil,
// so the work is bounded by the route's max duration). Call it only after the transaction that
// enqueued the job has committed. If the work is cut short, the job stays pending and the daily
// sweep retries it. Failures are logged without the address.
export function sendEmailJobAfterResponse(id: string): void {
  after(async () => {
    try {
      await processEmailJob(id);
    } catch (error) {
      console.error("Email job could not be processed", { id, error: error instanceof Error ? error.message : "unknown" });
    }
  });
}
