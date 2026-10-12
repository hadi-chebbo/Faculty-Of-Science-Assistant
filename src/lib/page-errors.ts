import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NotFoundError, ValidationError } from "@/services/errors";

// Runs a service read for a page, at request time only. Without connection() Next.js would
// try to run the database query while prerendering and fail the build.
// A missing record or unusable input renders the 404 page; anything else is rethrown to the
// error boundary (which shows no details).
export async function readForPage<T>(read: () => Promise<T>): Promise<T> {
  await connection();
  try {
    return await read();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) notFound();
    throw error;
  }
}
