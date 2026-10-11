import pg from "pg";
import { Sequelize } from "sequelize";
import { getEnv } from "../lib/env";

// Kept on globalThis so Next.js hot reload in development does not open a new pool per reload.
const globalForSequelize = globalThis as typeof globalThis & {
  __sequelize?: Sequelize;
};

// Created lazily so importing this module never needs a database (build, tests).
export function getSequelize(): Sequelize {
  if (!globalForSequelize.__sequelize) {
    const env = getEnv();
    globalForSequelize.__sequelize = new Sequelize(env.DATABASE_URL, {
      dialect: "postgres",
      // Pass the driver explicitly so Next.js bundling does not break Sequelize's dynamic require.
      dialectModule: pg,
      logging: false,
      // Small pool: serverless functions each hold their own pool.
      pool: { max: 3, idle: 10_000, acquire: 10_000 },
      dialectOptions:
        env.DATABASE_SSL === "true"
          ? { ssl: { require: true, rejectUnauthorized: true } }
          : {},
    });
  }
  return globalForSequelize.__sequelize;
}
