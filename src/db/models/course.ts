import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from "sequelize";
import type { Resource } from "./resource";

export class Course extends Model<InferAttributes<Course>, InferCreationAttributes<Course>> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare title: string;
  declare semester: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare resources?: NonAttribute<Resource[]>;
}

export function initCourse(sequelize: Sequelize): typeof Course {
  Course.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(20), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      semester: { type: DataTypes.SMALLINT, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "courses", underscored: true },
  );
  return Course;
}
