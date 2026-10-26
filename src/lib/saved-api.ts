import { connection } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { isSameOrigin } from "@/lib/auth/request";
import { reply } from "@/lib/resources-api";
import { getAccount } from "@/services/auth/auth";
import { NotFoundError } from "@/services/errors";
import type { Viewer } from "@/services/viewer";

// Shared by the saved-resource routes, which any signed-in user may call (the admin write routes
// use `adminWrite`). `request` is given for writes, which need the same-origin check first. The
// viewer is the account that still exists, with the role from the database; no or an expired
// token, or a deleted user, is 401. A not-found error is 404; anything else is 500.
export async function signedIn(
  request: Request | null,
  action: (viewer: NonNullable<Viewer>) => Promise<Response>,
): Promise<Response> {
  if (request && !isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);
  // Per-request answer, never prerendered at build time; outside the try so the build sees it.
  await connection();
  try {
    const account = await getAccount(await getViewer());
    if (!account) return reply({ error: "Not signed in" }, 401);
    return await action({ id: account.id, role: account.role });
  } catch (error) {
    if (error instanceof NotFoundError) return reply({ error: "Resource not found" }, 404);
    console.error("saved resources failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}
