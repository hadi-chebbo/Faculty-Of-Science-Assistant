import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
  fn,
} from "sequelize";

export type EmailJobStatus = "pending" | "sent" | "failed";

// RULE: `payload` never holds a secret (no token, no password). Handlers create secrets when the
// email is sent. `lastError` is a short reason without the address or any token.
export class EmailJob extends Model<InferAttributes<EmailJob>, InferCreationAttributes<EmailJob>> {
  declare id: CreationOptional<string>;
  declare kind: string;
  declare toEmail: string;
  declare payload: CreationOptional<Record<string, unknown>>;
  declare status: CreationOptional<EmailJobStatus>;
  declare attempts: CreationOptional<number>;
  declare nextAttemptAt: CreationOptional<Date>;
  declare lastError: CreationOptional<string | null>;
  declare sentAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initEmailJob(sequelize: Sequelize): typeof EmailJob {
  EmailJob.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      kind: { type: DataTypes.STRING, allowNull: false },
      toEmail: { type: DataTypes.STRING(254), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      // The database's clock, not the app's: claims compare with now() in SQL, and an app clock even a
      // millisecond ahead would make a new job "not due yet" so it waited for the daily sweep.
      nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: fn("now") },
      lastError: { type: DataTypes.STRING(500), allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "email_jobs", underscored: true },
  );
  return EmailJob;
}
