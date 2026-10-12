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
import type { Resource } from "./resource";
import type { User } from "./user";

export class Bookmark extends Model<InferAttributes<Bookmark>, InferCreationAttributes<Bookmark>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare resourceId: ForeignKey<Resource["id"]>;
  declare createdAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare resource?: NonAttribute<Resource>;
}

export function initBookmark(sequelize: Sequelize): typeof Bookmark {
  Bookmark.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      resourceId: { type: DataTypes.UUID, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "bookmarks", underscored: true, updatedAt: false },
  );
  return Bookmark;
}
