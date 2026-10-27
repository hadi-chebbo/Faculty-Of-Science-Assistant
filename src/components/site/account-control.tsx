"use client";

import { LogOut, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findAccount, type Account } from "@/lib/auth/client-session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";

// undefined: still asking. null: signed out (or the request failed).
type State = Account | null | undefined;

function displayName(account: Account): string {
  return account.name?.trim() || (account.role === "admin" ? "Admin" : "Account");
}

// Up to two initials from the name ("Demo Student" → "DS"); none without a name.
export function initialsOf(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// Same box as the avatar button, so nothing moves when the answer arrives. "Sign in" is wider and
// may shift the bar slightly for a visitor; the pages themselves never move.
const placeholder = <div aria-hidden className="size-11 md:size-9" />;

// Public pages are static, so the browser asks who is signed in after the page has loaded.
export function AccountControl() {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<State>(undefined);

  const mayRefresh = !pathname.startsWith("/admin");
  const load = useCallback(() => {
    void findAccount(mayRefresh).then(setAccount);
  }, [mayRefresh]);

  useEffect(() => {
    load();
    window.addEventListener(SESSION_CHANGED_EVENT, load);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, load);
  }, [load]);

  async function signOut() {
    try {
      await fetch("/api/v1/auth/sign-out", { method: "POST" });
    } finally {
      setAccount(null);
      if (pathname.startsWith("/admin")) router.replace("/sign-in");
    }
  }

  if (account === undefined) return placeholder;

  if (account === null) {
    return (
      <Button asChild variant="outline" className="h-11 md:h-9">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const name = displayName(account);
  const initials = initialsOf(account.name);
  // The pages (Saved, To-do) live in the main navigation; this menu only holds the account itself.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={name} className="size-11 rounded-full md:size-9">
          <Avatar className="size-9 md:size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-link">
              {initials || <User className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="truncate font-medium text-heading">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account.role === "admin" && (
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/admin">
              <Shield aria-hidden /> Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="min-h-11 md:min-h-8" onSelect={() => void signOut()}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
