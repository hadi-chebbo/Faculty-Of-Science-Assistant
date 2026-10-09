import { getSequelize } from "@/lib/db";

// Route handlers are dynamic by default under cacheComponents, so this is never cached.
// Liveness plus database reachability. Never returns error details to the caller.
export async function GET() {
  try {
    await getSequelize().authenticate();
    return Response.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
