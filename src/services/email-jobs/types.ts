export type EmailJobView = {
  id: string;
  kind: string;
  toEmail: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type EmailContent = { subject: string; text: string; html: string };

// A handler builds the message for one kind of job. It may do database work (for example mint a
// token), because secrets are created at send time and never stored in the payload. Returning
// null means there is nothing to send any more (the user was deleted or has already confirmed):
// the job is deleted.
export type EmailHandler = (job: EmailJobView) => Promise<EmailContent | null> | EmailContent | null;

export type EmailJobOutcome = "sent" | "retry" | "failed" | "skipped" | "cancelled";

export type SweepResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
  pruned: number;
};
