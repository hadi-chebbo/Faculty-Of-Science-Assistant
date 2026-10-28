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

// An active day: a Beirut calendar day ("YYYY-MM-DD") on which the user made a completion.
export class StudyDay extends Model<InferAttributes<StudyDay>, InferCreationAttributes<StudyDay>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare day: string;
  declare createdAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

export function initStudyDay(sequelize: Sequelize): typeof StudyDay {
  StudyDay.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      day: { type: DataTypes.DATEONLY, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "study_days", underscored: true, updatedAt: false },
  );
  return StudyDay;
}
