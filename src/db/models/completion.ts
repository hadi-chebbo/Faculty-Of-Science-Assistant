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

export class Completion extends Model<InferAttributes<Completion>, InferCreationAttributes<Completion>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare resourceId: ForeignKey<Resource["id"]>;
  declare createdAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
  declare resource?: NonAttribute<Resource>;
}

export function initCompletion(sequelize: Sequelize): typeof Completion {
  Completion.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      resourceId: { type: DataTypes.UUID, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "completions", underscored: true, updatedAt: false },
  );
  return Completion;
}
