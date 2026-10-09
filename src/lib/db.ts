import pg from "pg";
import { Sequelize } from "sequelize";
import { getEnv } from "./env";

let instance: Sequelize | undefined;

// Created lazily so importing this module never needs a database (build, tests).
export function getSequelize(): Sequelize {
  if (!instance) {
    const env = getEnv();
    instance = new Sequelize(env.DATABASE_URL, {
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
  return instance;
}
