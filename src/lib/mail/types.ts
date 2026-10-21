export type MailMessage = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  // Resolves when the provider accepted the message; throws otherwise. Errors never carry the
  // address, the body or a response body.
  send(message: MailMessage): Promise<void>;
}
