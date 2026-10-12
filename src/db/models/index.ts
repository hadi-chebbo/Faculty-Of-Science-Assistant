import type { Sequelize } from "sequelize";
import { getSequelize } from "../sequelize";
import { Bookmark, initBookmark } from "./bookmark";
import { Completion, initCompletion } from "./completion";
import { Course, initCourse } from "./course";
import { FailedSignIn, initFailedSignIn } from "./failed-sign-in";
import { RefreshToken, initRefreshToken } from "./refresh-token";
import { Resource, initResource } from "./resource";
import { User, initUser } from "./user";

export { Bookmark, Completion, Course, FailedSignIn, RefreshToken, Resource, User };

export interface Db {
  sequelize: Sequelize;
  Course: typeof Course;
  Resource: typeof Resource;
  User: typeof User;
  RefreshToken: typeof RefreshToken;
  Bookmark: typeof Bookmark;
  Completion: typeof Completion;
  FailedSignIn: typeof FailedSignIn;
}

// Cached on globalThis together with the connection, so hot reload never re-initialises models.
const globalForDb = globalThis as typeof globalThis & { __db?: Db };

// Initialises lazily: importing this module opens no connection and reads no environment.
export function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;

  const sequelize = getSequelize();
  initCourse(sequelize);
  initResource(sequelize);
  initUser(sequelize);
  initRefreshToken(sequelize);
  initBookmark(sequelize);
  initCompletion(sequelize);
  initFailedSignIn(sequelize);

  Course.hasMany(Resource, { foreignKey: "courseId", as: "resources" });
  Resource.belongsTo(Course, { foreignKey: "courseId", as: "course" });

  Resource.belongsTo(Resource, { foreignKey: "solutionOfId", as: "solutionOf" });
  Resource.hasMany(Resource, { foreignKey: "solutionOfId", as: "solutions" });

  User.hasMany(RefreshToken, { foreignKey: "userId", as: "refreshTokens" });
  User.hasMany(Bookmark, { foreignKey: "userId", as: "bookmarks" });
  User.hasMany(Completion, { foreignKey: "userId", as: "completions" });
  RefreshToken.belongsTo(User, { foreignKey: "userId", as: "user" });
  Bookmark.belongsTo(User, { foreignKey: "userId", as: "user" });
  Completion.belongsTo(User, { foreignKey: "userId", as: "user" });

  Bookmark.belongsTo(Resource, { foreignKey: "resourceId", as: "resource" });
  Completion.belongsTo(Resource, { foreignKey: "resourceId", as: "resource" });
  Resource.hasMany(Bookmark, { foreignKey: "resourceId", as: "bookmarks" });
  Resource.hasMany(Completion, { foreignKey: "resourceId", as: "completions" });

  globalForDb.__db = { sequelize, Course, Resource, User, RefreshToken, Bookmark, Completion, FailedSignIn };
  return globalForDb.__db;
}
