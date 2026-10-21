import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Keep Sequelize out of the bundle. Bundled, each route gets its own copy of the library, and
  // the connection created by one route (e.g. /api/health) cannot be used by the models of
  // another ("hasMany called with something that's not a subclass of Sequelize.Model").
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
  // The admin area shows per-user data, so browsers and shared caches must never keep it.
  async headers() {
    return [{ source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Error tracking build options (see docs/backend-architecture.md, "Error tracking"). Source maps
// are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set (then deleted
// from the output); without them the build uploads nothing.
export default withSentryConfig(nextConfig, {
  telemetry: false,
  silent: !process.env.CI,
  // Browser reports go through our own domain (a rewrite to Sentry), so blockers do not drop them.
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  // Tracing is not used, and this only feeds transaction names.
  routeManifestInjection: false,
  // The browser SDK is loaded lazily by src/instrumentation-client.ts; there is no navigation hook.
  suppressOnRouterTransitionStartWarning: true,
});
