import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export const RATE_LIMIT_ACTIONS = ["sign-up", "confirmation-email"] as const;
export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[number];

// One counted action (a sign-up from an IP, a confirmation email to an address). Not linked to users.
export class RateLimitEvent extends Model<
  InferAttributes<RateLimitEvent>,
  InferCreationAttributes<RateLimitEvent>
> {
  declare id: CreationOptional<string>;
  declare action: RateLimitAction;
  declare subject: string;
  declare createdAt: CreationOptional<Date>;
}

export function initRateLimitEvent(sequelize: Sequelize): typeof RateLimitEvent {
  RateLimitEvent.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      action: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [[...RATE_LIMIT_ACTIONS]] } },
      subject: { type: DataTypes.STRING(254), allowNull: false },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "rate_limit_events", underscored: true, updatedAt: false },
  );
  return RateLimitEvent;
}
