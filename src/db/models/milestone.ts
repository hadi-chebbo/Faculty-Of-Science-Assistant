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
import { MILESTONE_KEYS, type MilestoneKey } from "../constants";
import type { User } from "./user";

// A milestone a user has earned. One row per user and key; never removed.
export class Milestone extends Model<InferAttributes<Milestone>, InferCreationAttributes<Milestone>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User["id"]>;
  declare key: MilestoneKey;
  declare earnedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

export function initMilestone(sequelize: Sequelize): typeof Milestone {
  Milestone.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      key: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [[...MILESTONE_KEYS]] } },
      earnedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "milestones", underscored: true, timestamps: false },
  );
  return Milestone;
}
