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
import type { TodoStatus } from "../constants";
import type { Resource } from "./resource";
import type { User } from "./user";

// A card on a student's to-do board. statusChangedAt and deletedAt are separate from
// createdAt/updatedAt.
export class Todo extends Model<InferAttributes<Todo>, InferCreationAttributes<Todo>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare status: CreationOptional<TodoStatus>;
  declare position: number;
  declare title: CreationOptional<string>;
  declare note: CreationOptional<string>;
  declare resourceId: CreationOptional<ForeignKey<Resource["id"]> | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare statusChangedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare user?: NonAttribute<User>;
  declare resource?: NonAttribute<Resource>;
}

export function initTodo(sequelize: Sequelize): typeof Todo {
  Todo.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "todo" },
      position: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      resourceId: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      statusChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "todos", underscored: true },
  );
  return Todo;
}
