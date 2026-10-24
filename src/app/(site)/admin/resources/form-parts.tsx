import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export const fieldClass = "h-11 md:h-9";
export const selectClass = "w-full [&_select]:h-11 md:[&_select]:h-9";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  );
}

// A label, one control, an optional hint and the field's error.
export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <FieldError id={id} error={error} />
    </div>
  );
}

// The same for a group of radio buttons, which is labelled by a legend instead.
export function RadioField({
  id,
  legend,
  hideLegend,
  error,
  children,
}: {
  id: string;
  legend: string;
  hideLegend?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-medium text-heading"}>{legend}</legend>
      {children}
      <FieldError id={id} error={error} />
    </fieldset>
  );
}

// One group of fields in its own card, with a heading and a line saying what it is for.
export function FormCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold text-heading">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}
