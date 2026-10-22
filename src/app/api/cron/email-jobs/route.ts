import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deleteUnconfirmedAccounts } from "@/services/auth/sign-up";
import { processDueEmailJobs } from "@/services/email-jobs/sweep";
import "@/services/register-email-handlers";

const NO_STORE = { "Cache-Control": "no-store" };

function bearerMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Daily sweep (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`): retries what is due and
// deletes student accounts never confirmed within 7 days.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503, headers: NO_STORE });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const sweep = await processDueEmailJobs();
  const deletedUnconfirmed = await deleteUnconfirmedAccounts();
  return NextResponse.json({ ...sweep, deletedUnconfirmed }, { status: 200, headers: NO_STORE });
}
