"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESEND_COOLDOWN_SECONDS, RESEND_MESSAGES, requestNewLink } from "@/lib/auth/resend-client";

// "Send a new link". With a known email it is just a button; without one it asks for the address.
// `waitOnArrival` starts the 60 s wait at once (the sign-up that brought the student here just sent one).
export function ResendLink({ email, waitOnArrival }: { email: string | null; waitOnArrival: boolean }) {
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(waitOnArrival ? RESEND_COOLDOWN_SECONDS : 0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || seconds > 0) return;
    setPending(true);
    setMessage(null);
    const result = await requestNewLink(email ?? typed.trim());
    if (result === "network") setMessage({ text: RESEND_MESSAGES.network, error: true });
    else if (result.kind === "sent") {
      setMessage({ text: RESEND_MESSAGES.sent, error: false });
      setSeconds(RESEND_COOLDOWN_SECONDS);
    } else if (result.kind === "wait") {
      setMessage({ text: RESEND_MESSAGES.wait, error: false });
      setSeconds(result.seconds);
    } else setMessage({ text: RESEND_MESSAGES[result.kind], error: true });
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending} className="space-y-4">
      {email === null && (
        <div className="space-y-2">
          <Label htmlFor="resend-email">Email</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={pending}
            className="h-11"
          />
        </div>
      )}
      <Button type="submit" variant="outline" disabled={pending || seconds > 0} className="h-11 w-full text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {seconds > 0 ? `Send a new link (${seconds} s)` : "Send a new link"}
      </Button>
      {/* Always rendered so assistive technology announces the text when it appears. */}
      <p role="status" className={message?.error ? "text-sm font-medium text-destructive empty:mt-0" : "text-sm text-heading empty:mt-0"}>
        {message?.text}
      </p>
    </form>
  );
}
