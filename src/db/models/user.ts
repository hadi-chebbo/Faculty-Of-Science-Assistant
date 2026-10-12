import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from "sequelize";
import { USER_ROLES } from "../constants";
import type { UserRole } from "../constants";
import type { Bookmark } from "./bookmark";
import type { Completion } from "./completion";
import type { RefreshToken } from "./refresh-token";

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare name: CreationOptional<string | null>;
  declare passwordHash: string;
  declare role: CreationOptional<UserRole>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare refreshTokens?: NonAttribute<RefreshToken[]>;
  declare bookmarks?: NonAttribute<Bookmark[]>;
  declare completions?: NonAttribute<Completion[]>;
}

export function initUser(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        // The database rejects anything that is not trimmed and lowercase.
        set(this: User, value: string) {
          this.setDataValue("email", value.trim().toLowerCase());
        },
      },
      name: { type: DataTypes.STRING(100), allowNull: true },
      passwordHash: { type: DataTypes.TEXT, allowNull: false },
      role: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "student",
        validate: { isIn: [[...USER_ROLES]] },
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: "users",
      underscored: true,
      defaultScope: { attributes: { exclude: ["passwordHash"] } },
      scopes: { withPasswordHash: { attributes: { include: ["passwordHash"] } } },
    },
  );
  return User;
}
