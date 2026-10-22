"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SIGNUP_EMAIL_KEY } from "@/lib/auth/signup-storage";

type Fields = { name?: string; email?: string; password?: string };

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    setFields({});
    try {
      const response = await fetch("/api/v1/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.get("password"), ...(name ? { name } : {}) }),
      });
      if (response.status === 202) {
        try {
          sessionStorage.setItem(SIGNUP_EMAIL_KEY, email);
        } catch {
          // Storage blocked: the next page asks for the address instead.
        }
        // Stay in the loading state until the navigation replaces this page.
        router.push("/sign-up/check-email");
        return;
      }
      if (response.status === 429) {
        setError("Too many sign-ups from this network. Please try again later.");
      } else if (response.status === 400) {
        const body: { fields?: Fields } | null = await response.json().catch(() => null);
        if (body?.fields && Object.keys(body.fields).length > 0) setFields(body.fields);
        else setError("Please check the details and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription className="font-medium text-destructive">{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={100}
          disabled={pending}
          aria-invalid={fields.name ? true : undefined}
          aria-describedby={fields.name ? "name-error" : undefined}
          className="h-11"
        />
        {fields.name && <FieldError id="name-error">{fields.name}</FieldError>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={pending}
          aria-invalid={fields.email ? true : undefined}
          aria-describedby={fields.email ? "email-error" : undefined}
          className="h-11"
        />
        {fields.email && <FieldError id="email-error">{fields.email}</FieldError>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={1024}
            disabled={pending}
            aria-invalid={fields.password ? true : undefined}
            aria-describedby={fields.password ? "password-hint password-error" : "password-hint"}
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
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least 10 characters.
        </p>
        {fields.password && <FieldError id="password-error">{fields.password}</FieldError>}
      </div>
      <Button type="submit" disabled={pending} className="h-11 w-full text-base">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}
