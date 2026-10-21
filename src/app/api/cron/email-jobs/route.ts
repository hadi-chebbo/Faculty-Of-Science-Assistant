import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processDueEmailJobs } from "@/services/email-jobs/sweep";

const NO_STORE = { "Cache-Control": "no-store" };

function bearerMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Daily sweep (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`): retries what is due.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503, headers: NO_STORE });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json(await processDueEmailJobs(), { status: 200, headers: NO_STORE });
}
