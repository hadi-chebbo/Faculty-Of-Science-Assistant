import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Keep Sequelize out of the bundle. Bundled, each route gets its own copy of the library, and
  // the connection created by one route (e.g. /api/health) cannot be used by the models of
  // another ("hasMany called with something that's not a subclass of Sequelize.Model").
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
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
