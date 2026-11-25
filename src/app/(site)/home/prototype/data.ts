// PROTOTYPE (throwaway): real numbers when the database answers, sample numbers when it does not,
// so the variants can be looked at without Postgres running.
import { getHomeStats, type HomeStats } from "@/services/courses/home";

const SAMPLE: HomeStats = {
  totals: { courses: 24, chapters: 96, resources: 307, exams: 58 },
  years: [
    { year: 1, courseCount: 8, resourceCount: 120, courseCodes: ["I1101", "I1102", "I1103", "I1201", "I1202", "I1203", "I1204", "I1205"] },
    { year: 2, courseCount: 8, resourceCount: 110, courseCodes: ["I2101", "I2102", "I2103", "I2201", "I2202", "I2203", "I2204", "I2205"] },
    { year: 3, courseCount: 8, resourceCount: 77, courseCodes: ["I3301", "I3302", "I3303", "I3305", "I3401", "I3402", "I3403", "I3404"] },
    { year: 4, courseCount: 0, resourceCount: 0, courseCodes: [] },
  ],
};

export async function protoStats(): Promise<HomeStats> {
  try {
    return await getHomeStats(null);
  } catch {
    return SAMPLE;
  }
}
