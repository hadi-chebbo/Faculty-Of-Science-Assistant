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

export class Lecturer extends Model<InferAttributes<Lecturer>, InferCreationAttributes<Lecturer>> {
  declare id: CreationOptional<string>;
  declare name: string;
  // Set once when the lecturer is created; a rename never changes it.
  declare slug: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare resources?: NonAttribute<Resource[]>;
}

export function initLecturer(sequelize: Sequelize): typeof Lecturer {
  Lecturer.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "lecturers", underscored: true },
  );
  return Lecturer;
}
