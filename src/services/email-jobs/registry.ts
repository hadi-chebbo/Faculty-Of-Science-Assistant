import type { EmailHandler } from "./types";

const handlers = new Map<string, EmailHandler>();

export function registerEmailHandler(kind: string, handler: EmailHandler): void {
  handlers.set(kind, handler);
}

export function getEmailHandler(kind: string): EmailHandler | undefined {
  return handlers.get(kind);
}
