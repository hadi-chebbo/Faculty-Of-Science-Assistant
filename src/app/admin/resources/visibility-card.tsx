import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { RadioField } from "./form-parts";

const CHOICE =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border p-3 has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50";

// Draft or published, the form's error message and the actions: the primary button follows the choice.
export function VisibilityCard({
  isPublished,
  onChange,
  error,
  formError,
  pending,
  uploading = false,
  canDelete,
  onDelete,
}: {
  isPublished: boolean;
  onChange: (isPublished: boolean) => void;
  error?: string;
  formError: string | null;
  pending: boolean;
  uploading?: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold text-heading">Visibility</h2>
      <RadioField id="isPublished" legend="Who can see it" hideLegend error={error}>
        <div className="grid gap-2">
          <label className={CHOICE}>
            <input type="radio" name="visibility" checked={!isPublished} onChange={() => onChange(false)} className="mt-1 accent-primary" />
            <span>
              <b className="block text-sm font-medium text-heading">Draft</b>
              <small className="block text-[0.8125rem] leading-snug text-muted-foreground">Only you can see it.</small>
            </span>
          </label>
          <label className={CHOICE}>
            <input type="radio" name="visibility" checked={isPublished} onChange={() => onChange(true)} className="mt-1 accent-primary" />
            <span>
              <b className="block text-sm font-medium text-heading">Published</b>
              <small className="block text-[0.8125rem] leading-snug text-muted-foreground">Visible to students. Needs a file or link.</small>
            </span>
          </label>
        </div>
      </RadioField>

      {formError && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <Button type="submit" disabled={pending || uploading} className="h-11 w-full">
          {pending ? "Saving..." : uploading ? "Uploading..." : isPublished ? "Save and publish" : "Save draft"}
        </Button>
        <div className={canDelete ? "grid grid-cols-2 gap-2" : "grid"}>
          <Link href="/admin" className={buttonVariants({ variant: "outline", className: "h-11" })}>
            Cancel
          </Link>
          {canDelete && (
            <Button type="button" variant="ghost" disabled={pending} onClick={onDelete} className="h-11 text-destructive hover:text-destructive">
              Delete
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
