// Read by sequelize-cli only. The application uses src/lib/db.ts.
// DATABASE_URL is loaded from .env by the db:* npm scripts.
module.exports = {
  url: process.env.DATABASE_URL,
  dialect: "postgres",
  // Neon (and most hosted Postgres) requires TLS; local Docker does not.
  dialectOptions:
    process.env.DATABASE_SSL === "true"
      ? { ssl: { require: true, rejectUnauthorized: true } }
      : {},
};
