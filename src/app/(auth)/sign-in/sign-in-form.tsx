"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHydrated } from "@/lib/use-hydrated";
import { RESEND_MESSAGES, requestNewLink } from "@/lib/auth/resend-client";
import { safeNextPath } from "@/lib/auth/request";
import { announceSessionChange } from "@/lib/auth/session-events";
import { maskEmail } from "@/lib/mask-email";

// The route sets the session cookies; this page never sees a token.
export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The submit button stays disabled until hydration, so a native submit can never slip through.
  const hydrated = useHydrated();
  // The address whose password was right but whose email is not confirmed yet.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resend, setResend] = useState<{ pending: boolean; text: string | null }>({ pending: false, text: null });
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const refocusPassword = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The inputs are disabled while a request runs, so focus can only move once they are enabled again.
  useEffect(() => {
    if (refocusPassword.current && !pending) {
      refocusPassword.current = false;
      passwordRef.current?.focus();
    }
  }, [pending]);

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    setPending(true);
    setError(null);
    setUnconfirmed(null);
    setResend({ pending: false, text: null });
    try {
      const response = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.get("password") }),
      });
      if (response.ok) {
        const body: { user?: { role?: string } } | null = await response.json().catch(() => null);
        announceSessionChange();
        // Stay in the loading state until the navigation replaces this page.
        // `next` is only ever used as a path here, after the same-site check; it is never rendered.
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(safeNextPath(next, body?.user?.role === "admin" ? "/admin" : "/"));
        return;
      }
      if (response.status === 429) {
        setError("Too many failed attempts. Please wait a few minutes and try again.");
      } else if (response.status === 403) {
        const body: { code?: string } | null = await response.json().catch(() => null);
        if (body?.code === "email_not_confirmed") setUnconfirmed(email);
        else setError("Something went wrong. Please try again.");
      } else if (response.status === 401) {
        setError("Invalid email or password.");
        if (passwordRef.current) passwordRef.current.value = "";
        setCapsLock(false);
        refocusPassword.current = true;
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  async function sendNewLink() {
    if (!unconfirmed) return;
    setResend({ pending: true, text: null });
    const result = await requestNewLink(unconfirmed);
    const text =
      result === "network"
        ? RESEND_MESSAGES.network
        : result.kind === "sent" || result.kind === "wait" || result.kind === "invalid" || result.kind === "error"
          ? RESEND_MESSAGES[result.kind]
          : null;
    setResend({ pending: false, text });
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      onChange={() => {
        setError(null);
        setUnconfirmed(null);
      }}
      aria-busy={pending}
      className="space-y-5"
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription className="font-medium text-destructive">{error}</AlertDescription>
        </Alert>
      )}
      {unconfirmed && (
        <Alert>
          <AlertDescription className="space-y-3 text-foreground">
            <p>Confirm your email first. We sent a link to {maskEmail(unconfirmed)}.</p>
            <Button type="button" variant="outline" onClick={sendNewLink} disabled={resend.pending} className="h-11">
              {resend.pending && <Loader2 className="animate-spin" aria-hidden />}
              Send a new link
            </Button>
            <p role="status" className="font-medium text-heading empty:hidden">
              {resend.text}
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          disabled={pending}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={1024}
            disabled={pending}
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={() => setCapsLock(false)}
            className="h-11 pr-12"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute top-0 right-0 size-11 text-muted-foreground"
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
        {/* Always present so screen readers announce the hint; it takes no room while empty. */}
        <p aria-live="polite" className="text-sm text-muted-foreground empty:mt-0">
          {capsLock ? "Caps Lock is on." : null}
        </p>
      </div>
      <Button type="submit" disabled={pending || !hydrated} className="h-11 w-full text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
