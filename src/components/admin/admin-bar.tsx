import Link from "next/link";
import { SignOutButton } from "@/app/admin/sign-out-button";

// Compact frame at the top of every admin page: the admin sections on the left, the account on the right. Rendered by the page content only after
// `requireAdminPage` has passed, with the account passed in; it never reads the session itself.
export function AdminBar({ email }: { email: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-2">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline md:min-h-9"
      >
        Resources
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="min-w-0 break-all text-sm">
          Signed in as <strong className="font-semibold text-heading">{email}</strong>
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
