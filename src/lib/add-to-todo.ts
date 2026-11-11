"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { BOARD_FULL_MESSAGE, boardRequest } from "@/lib/board-api";
import { useSignedInCheck } from "@/lib/saved-client";
import { requestSignIn } from "@/lib/sign-in-dialog";

// "Add to to-do": a new card in To do linked to a file, from the reader and the Saved page. The same
// file may be added again; each press makes a card. Signed out, it opens the sign-in dialog over
// the page and, after a successful sign-in, adds the card.
export function useAddToTodo(resourceId: string): { pending: boolean; add: () => Promise<void> } {
  const router = useRouter();
  const check = useSignedInCheck();
  const [pending, setPending] = useState(false);

  const add = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      let who = await check();
      if (who === "signed-out") {
        if (!(await requestSignIn("add-to-todo"))) return;
        who = await check();
      }
      if (who === "unknown" || who === "signed-out") {
        toast.error("Couldn't reach the server. Try again.");
        return;
      }
      let response = await boardRequest("POST", "", { resourceId });
      if (response.status === 401) {
        // The session ended while the store believed in it: same as signed out.
        if (!(await requestSignIn("add-to-todo"))) return;
        response = await boardRequest("POST", "", { resourceId });
      }
      if (response.ok) {
        toast.success("Added to To do", { action: { label: "View board", onClick: () => router.push("/todo") } });
      } else if (response.status === 409) {
        toast.error(BOARD_FULL_MESSAGE);
      } else if (response.status === 404) {
        toast.error("This file can no longer be added.");
      } else {
        toast.error("Couldn't add it to your to-do. Try again.");
      }
    } catch {
      toast.error("Couldn't add it to your to-do. Try again.");
    } finally {
      setPending(false);
    }
  }, [pending, check, resourceId, router]);

  return { pending, add };
}
