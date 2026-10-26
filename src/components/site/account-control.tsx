"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findAccount, type Account } from "@/lib/auth/client-session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";

// undefined: still asking. null: signed out (or the request failed).
type State = Account | null | undefined;

function displayName(account: Account): string {
  return account.name?.trim() || (account.role === "admin" ? "Admin" : "Account");
}

// Same box as the button, so nothing moves when the answer arrives.
const placeholder = <div aria-hidden className="h-11 w-24 md:h-9" />;

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 max-w-32 md:h-9 md:max-w-48">
          <User aria-hidden />
          <span className="truncate">{displayName(account)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {account.role === "admin" && (
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/admin">Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="min-h-11 md:min-h-8" onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
