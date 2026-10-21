export type EmailJobView = {
  id: string;
  kind: string;
  toEmail: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type EmailContent = { subject: string; text: string; html: string };

// A handler builds the message for one kind of job. It may do database work (for example mint a
// token), because secrets are created at send time and never stored in the payload.
export type EmailHandler = (job: EmailJobView) => Promise<EmailContent> | EmailContent;

export type EmailJobOutcome = "sent" | "retry" | "failed" | "skipped";

export type SweepResult = { processed: number; sent: number; retried: number; failed: number; pruned: number };
