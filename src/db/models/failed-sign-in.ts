import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class FailedSignIn extends Model<
  InferAttributes<FailedSignIn>,
  InferCreationAttributes<FailedSignIn>
> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare ip: string;
  declare createdAt: CreationOptional<Date>;
}

export function initFailedSignIn(sequelize: Sequelize): typeof FailedSignIn {
  FailedSignIn.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING(254), allowNull: false },
      ip: { type: DataTypes.STRING(64), allowNull: false },
      createdAt: DataTypes.DATE,
    },
    { sequelize, tableName: "failed_sign_ins", underscored: true, updatedAt: false },
  );
  return FailedSignIn;
}
