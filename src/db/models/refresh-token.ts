import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from "sequelize";
import type { User } from "./user";

export class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare tokenHash: string;
  declare familyId: string;
  declare expiresAt: Date;
  declare revokedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

export function initRefreshToken(sequelize: Sequelize): typeof RefreshToken {
  RefreshToken.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false },
      familyId: { type: DataTypes.UUID, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "refresh_tokens", underscored: true, updatedAt: false },
  );
  return RefreshToken;
}
