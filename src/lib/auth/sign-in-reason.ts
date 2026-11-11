import { safeNextPath } from "@/lib/auth/request";

// Why a visitor is asked to sign in, for the three private pages: the in-page state on the page
// itself and the "why you're here" line on /sign-in share these texts.
export type PrivatePage = "saved" | "todo" | "progress";

export const SIGN_IN_REASONS: Record<PrivatePage, { path: string; title: string; line: string }> = {
  saved: {
    path: "/saved",
    title: "Sign in to see your saved files",
    line: "Saved files are kept in your account. Browsing and downloading never need one.",
  },
  todo: {
    path: "/todo",
    title: "Sign in to use your to-do board",
    line: "Your board is kept in your account. Browsing and downloading never need one.",
  },
  progress: {
    path: "/progress",
    title: "Sign in to see your progress",
    line: "Progress is built from the files you mark as done. Browsing and downloading never need an account.",
  },
};

// The reason line for a `?next=` value, or null when it is not one of the private pages.
export function signInReasonFor(next: string | null | undefined): string | null {
  if (!next) return null;
  const path = safeNextPath(next, "").split("?")[0];
  const page = (Object.keys(SIGN_IN_REASONS) as PrivatePage[]).find((key) => SIGN_IN_REASONS[key].path === path);
  return page ? SIGN_IN_REASONS[page].title : null;
}
