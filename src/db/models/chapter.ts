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
import type { Course } from "./course";
import type { Resource } from "./resource";

export class Chapter extends Model<InferAttributes<Chapter>, InferCreationAttributes<Chapter>> {
  declare id: CreationOptional<string>;
  declare courseId: ForeignKey<Course["id"]>;
  declare position: number;
  declare title: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare course?: NonAttribute<Course>;
  declare resources?: NonAttribute<Resource[]>;
}

export function initChapter(sequelize: Sequelize): typeof Chapter {
  Chapter.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      courseId: { type: DataTypes.UUID, allowNull: false },
      position: { type: DataTypes.SMALLINT, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "chapters", underscored: true },
  );
  return Chapter;
}
