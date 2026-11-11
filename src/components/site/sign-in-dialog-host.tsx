"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SignInFields } from "@/components/auth/sign-in-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SIGN_IN_ACTION_TEXT, signInDialog } from "@/lib/sign-in-dialog";

// The one sign-in dialog, mounted once in SiteChrome and opened by `requestSignIn`. Radix traps
// focus and closes on Esc; focus goes back to the control that was tapped.
export function SignInDialogHost() {
  const request = useSyncExternalStore(signInDialog.subscribe, signInDialog.get, () => null);
  const text = request ? SIGN_IN_ACTION_TEXT[request.action] : null;
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && signInDialog.finish(false)}>
      {request && text && (
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            // The tapped control, also after a successful sign-in (it may have re-rendered).
            const target = request.returnFocus;
            if (target && target.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-heading">{text.title}</DialogTitle>
            <DialogDescription>You&apos;ll stay on this page, and we&apos;ll do it for you.</DialogDescription>
          </DialogHeader>
          <SignInFields idPrefix="dialog-" submitLabel={text.submit} onSuccess={() => signInDialog.finish(true)} />
          <div className="flex flex-col gap-2 text-sm">
            <p>
              New here?{" "}
              <Link
                href="/sign-up"
                onClick={() => signInDialog.finish(false)}
                className="inline-flex min-h-11 items-center rounded-md font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Create an account
              </Link>
            </p>
            <Button type="button" variant="outline" className="h-11" onClick={() => signInDialog.finish(false)}>
              Not now
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
