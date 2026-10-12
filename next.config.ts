import type { NextConfig } from "next";

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

export default nextConfig;
