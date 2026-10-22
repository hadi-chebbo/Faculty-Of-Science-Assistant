import { z } from "zod";

const urlSchema = z.url({ protocol: /^https?$/ });

// The public address of the site, for links in emails. Read lazily so the build needs nothing.
// APP_URL wins; on Vercel the production domain is used; otherwise local development.
export function getAppUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.APP_URL?.trim();
  if (configured) {
    const parsed = urlSchema.safeParse(configured);
    if (!parsed.success) throw new Error("APP_URL is not a valid http(s) URL");
    return configured.replace(/\/+$/, "");
  }
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
