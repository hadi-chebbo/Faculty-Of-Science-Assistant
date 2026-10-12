import type { WhereOptions } from "sequelize";
import { isAdmin, type Viewer } from "./viewer";

// The one place that decides which resources a viewer may see: admins see everything,
// everyone else sees only published resources. Lists and counts both use it so they agree.
export function visibleResources(viewer: Viewer): WhereOptions {
  return isAdmin(viewer) ? {} : { isPublished: true };
}
