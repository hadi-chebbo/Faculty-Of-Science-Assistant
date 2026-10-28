import type { Sequelize } from "sequelize";
import { getSequelize } from "../sequelize";
import { Bookmark, initBookmark } from "./bookmark";
import { Chapter, initChapter } from "./chapter";
import { Completion, initCompletion } from "./completion";
import { Course, initCourse } from "./course";
import { EmailConfirmation, initEmailConfirmation } from "./email-confirmation";
import { EmailJob, initEmailJob } from "./email-job";
import { FailedSignIn, initFailedSignIn } from "./failed-sign-in";
import { RateLimitEvent, initRateLimitEvent } from "./rate-limit-event";
import { RefreshToken, initRefreshToken } from "./refresh-token";
import { Resource, initResource } from "./resource";
import { StudyDay, initStudyDay } from "./study-day";
import { Milestone, initMilestone } from "./milestone";
import { Todo, initTodo } from "./todo";
import { User, initUser } from "./user";

export {
  Bookmark,
  Chapter,
  Completion,
  Course,
  EmailConfirmation,
  EmailJob,
  FailedSignIn,
  RateLimitEvent,
  RefreshToken,
  Resource,
  StudyDay,
  Milestone,
  Todo,
  User,
};

export interface Db {
  sequelize: Sequelize;
  Course: typeof Course;
  Chapter: typeof Chapter;
  Resource: typeof Resource;
  User: typeof User;
  RefreshToken: typeof RefreshToken;
  Bookmark: typeof Bookmark;
  Completion: typeof Completion;
  FailedSignIn: typeof FailedSignIn;
  EmailJob: typeof EmailJob;
  EmailConfirmation: typeof EmailConfirmation;
  RateLimitEvent: typeof RateLimitEvent;
  Todo: typeof Todo;
  StudyDay: typeof StudyDay;
  Milestone: typeof Milestone;
}

// Cached on globalThis together with the connection, so hot reload never re-initialises models.
const globalForDb = globalThis as typeof globalThis & { __db?: Db };

// Initialises lazily: importing this module opens no connection and reads no environment.
export function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;

  const sequelize = getSequelize();
  initCourse(sequelize);
  initChapter(sequelize);
  initResource(sequelize);
  initUser(sequelize);
  initRefreshToken(sequelize);
  initBookmark(sequelize);
  initCompletion(sequelize);
  initFailedSignIn(sequelize);
  initEmailJob(sequelize);
  initEmailConfirmation(sequelize);
  initRateLimitEvent(sequelize);
  initTodo(sequelize);
  initStudyDay(sequelize);
  initMilestone(sequelize);

  Course.hasMany(Resource, { foreignKey: "courseId", as: "resources" });
  Resource.belongsTo(Course, { foreignKey: "courseId", as: "course" });

  Course.hasMany(Chapter, { foreignKey: "courseId", as: "chapters" });
  Chapter.belongsTo(Course, { foreignKey: "courseId", as: "course" });
  Chapter.hasMany(Resource, { foreignKey: "chapterId", as: "resources" });
  Resource.belongsTo(Chapter, { foreignKey: "chapterId", as: "chapter" });

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

  User.hasMany(Todo, { foreignKey: "userId", as: "todos" });
  Todo.belongsTo(User, { foreignKey: "userId", as: "user" });
  Todo.belongsTo(Resource, { foreignKey: "resourceId", as: "resource" });
  Resource.hasMany(Todo, { foreignKey: "resourceId", as: "todos" });

  User.hasMany(StudyDay, { foreignKey: "userId", as: "studyDays" });
  StudyDay.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(Milestone, { foreignKey: "userId", as: "milestones" });
  Milestone.belongsTo(User, { foreignKey: "userId", as: "user" });

  globalForDb.__db = { sequelize, Course, Chapter, Resource, User, RefreshToken, Bookmark, Completion, FailedSignIn, EmailJob, EmailConfirmation, RateLimitEvent, Todo, StudyDay, Milestone };
  return globalForDb.__db;
}
