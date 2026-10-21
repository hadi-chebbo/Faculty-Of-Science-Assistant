"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { announceSessionChange } from "@/lib/auth/session-events";

// The route sets the session cookies; this page never sees a token.
export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (response.ok) {
        const body: { user?: { role?: string } } | null = await response.json().catch(() => null);
        announceSessionChange();
        // Stay in the loading state until the navigation replaces this page.
        router.replace(body?.user?.role === "admin" ? "/admin" : "/");
        return;
      }
      if (response.status === 429) {
        setError("Too many failed attempts. Please wait a few minutes and try again.");
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

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setError(null)}
      aria-busy={pending}
      className="space-y-5"
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription className="font-medium text-destructive">{error}</AlertDescription>
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
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {capsLock ? "Caps Lock is on." : null}
        </p>
      </div>
      <Button type="submit" disabled={pending} className="h-11 w-full text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
