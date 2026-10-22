import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

// One emailed confirmation link. Only the SHA-256 hash of the token is stored.
export class EmailConfirmation extends Model<
  InferAttributes<EmailConfirmation>,
  InferCreationAttributes<EmailConfirmation>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare usedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
}

export function initEmailConfirmation(sequelize: Sequelize): typeof EmailConfirmation {
  EmailConfirmation.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "email_confirmations", underscored: true, updatedAt: false },
  );
  return EmailConfirmation;
}
