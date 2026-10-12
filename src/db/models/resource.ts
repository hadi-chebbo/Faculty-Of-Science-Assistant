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
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TYPES } from "../constants";
import type { ExamSession, Language, ResourceType } from "../constants";
import type { Bookmark } from "./bookmark";
import type { Completion } from "./completion";
import type { Course } from "./course";

export class Resource extends Model<InferAttributes<Resource>, InferCreationAttributes<Resource>> {
  declare id: CreationOptional<string>;
  declare courseId: ForeignKey<Course["id"]>;
  declare type: ResourceType;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare academicYearStart: CreationOptional<number | null>;
  declare examSession: CreationOptional<ExamSession | null>;
  declare language: CreationOptional<Language>;
  declare fileKey: CreationOptional<string | null>;
  declare externalUrl: CreationOptional<string | null>;
  declare solutionOfId: CreationOptional<ForeignKey<Resource["id"]> | null>;
  declare isPublished: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare course?: NonAttribute<Course>;
  declare solutionOf?: NonAttribute<Resource>;
  declare solutions?: NonAttribute<Resource[]>;
  declare bookmarks?: NonAttribute<Bookmark[]>;
  declare completions?: NonAttribute<Completion[]>;
}

export function initResource(sequelize: Sequelize): typeof Resource {
  Resource.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      courseId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [[...RESOURCE_TYPES]] } },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      academicYearStart: { type: DataTypes.SMALLINT, allowNull: true },
      examSession: { type: DataTypes.STRING(10), allowNull: true, validate: { isIn: [[...EXAM_SESSIONS]] } },
      language: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: "en",
        validate: { isIn: [[...LANGUAGES]] },
      },
      fileKey: { type: DataTypes.TEXT, allowNull: true },
      externalUrl: { type: DataTypes.TEXT, allowNull: true },
      solutionOfId: { type: DataTypes.UUID, allowNull: true },
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "resources", underscored: true },
  );
  return Resource;
}
