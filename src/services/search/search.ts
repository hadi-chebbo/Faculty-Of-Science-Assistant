import { QueryTypes } from "sequelize";
import { getDb } from "@/db/models";
import { toResourceListItem, visibleSolutionsOf } from "../resources/resources";
import { parseInput } from "../validation";
import {
  buildTsQuery,
  CHIP_TYPES,
  chipForTypes,
  filterTypes,
  highlightTerms,
  joinedCode,
  parseSearchQuery,
  SEARCH_MIN_LENGTH,
  type ParsedQuery,
  type SearchChip,
} from "./query";
import { searchInputSchema, type SearchInput, type SearchSection } from "./schemas";
import {
  SEARCH_PAGE_SIZE,
  SEARCH_PREVIEW_SIZE,
  type ChapterHit,
  type CourseHit,
  type FileHit,
  type SearchGroup,
  type SearchOutcome,
} from "./types";

// Site search over courses, chapters and files, for visitors who are not signed in: only published
// files count, and a chapter is only listed when it has one. (An admin searching sees the same,
// which is what a student would see.)
//
// Matching is Postgres full-text search with the `simple` configuration (no stemming, no stop
// words) over unaccent(lower(text)), and every query word is a prefix: "algo" finds "Algorithms",
// "theorie" finds "Théorie". The query text is built by buildTsQuery from words that hold only
// letters and digits and is passed as a bound parameter, so input can never be tsquery syntax.
// A course is also found by its code with the spaces of the query taken out ("demo 301").
//
// There are no search indexes on purpose: the whole catalogue is a few hundred rows, so computing
// the text vectors while querying costs nothing noticeable. Add generated tsvector columns with
// GIN indexes if the data ever grows by orders of magnitude (see docs/backend-architecture.md).

// The full-text pieces. `$tsq` is the tsquery text, folded again by unaccent so that characters
// the database folds differently from JavaScript (ligatures, for one) still agree.
const QUERY = "to_tsquery('simple', unaccent($tsq::text))";
const vector = (expression: string) => `to_tsvector('simple', unaccent(lower(${expression})))`;

const COURSE_VECTOR = vector("c.code || ' ' || c.title");
const COURSE_TITLE_VECTOR = vector("c.title");
const CHAPTER_VECTOR = vector("ch.title");
const FILE_TITLE_VECTOR = vector("r.title");
// Title words outweigh description words in the relevance score.
const FILE_VECTOR = `(setweight(${FILE_TITLE_VECTOR}, 'A') || setweight(${vector("coalesce(r.description, '')")}, 'B'))`;

// A code typed with its spaces removed, compared with the stored code in the same form.
const CODE_FORM = "replace(unaccent(lower(c.code)), ' ', '')";

type Bind = Record<string, string | number | string[]>;

interface Plan {
  parsed: ParsedQuery;
  bind: Bind;
  hasText: boolean;
  // null: any kind of file.
  fileTypes: string[] | null;
}

export async function searchCatalog(query: string, options: Omit<SearchInput, "query"> = {}): Promise<SearchOutcome> {
  const input = parseInput(searchInputSchema, { query, ...options });
  const parsed = parseSearchQuery(input.query);
  const wordTypes = filterTypes(parsed);
  const impliedChip = chipForTypes(wordTypes);
  const chip: SearchChip = input.type ?? impliedChip;
  const outcome: SearchOutcome = {
    state: "results",
    query: input.query,
    chip,
    impliedChip,
    highlight: highlightTerms(parsed.words),
    filters: { types: wordTypes, sessions: parsed.sessions, year: parsed.year },
    show: null,
    courses: null,
    chapters: null,
    files: null,
    page: 1,
    pages: 1,
  };
  if (Array.from(input.query).length < SEARCH_MIN_LENGTH) return { ...outcome, state: "short" };

  const hasText = parsed.words.length > 0;
  const hasFilters = wordTypes.length > 0 || parsed.sessions.length > 0 || parsed.year !== null;
  // A query of nothing but punctuation has nothing to look for.
  if (!hasText && !hasFilters) return outcome;

  // The chip and the words both say which kinds of file; a file must satisfy both.
  const chipTypes = CHIP_TYPES[chip];
  let fileTypes: string[] | null = null;
  if (wordTypes.length > 0 && chipTypes) fileTypes = wordTypes.filter((type) => chipTypes.includes(type));
  else if (chipTypes) fileTypes = [...chipTypes];
  else if (wordTypes.length > 0) fileTypes = wordTypes;

  const plan: Plan = {
    parsed,
    hasText,
    fileTypes,
    bind: hasText ? { tsq: buildTsQuery(parsed.words), joined: joinedCode(parsed.words) } : {},
  };

  const enabled: Record<SearchSection, boolean> = {
    courses: hasText && chip !== "exam" && chip !== "lecture" && chip !== "exercise",
    chapters: hasText && chip === "all",
    files: chip !== "course" && (fileTypes === null || fileTypes.length > 0),
  };
  const show = input.show && enabled[input.show] ? input.show : null;
  if (show) {
    for (const section of Object.keys(enabled) as SearchSection[]) enabled[section] = section === show;
  }

  const size = show ? SEARCH_PAGE_SIZE : SEARCH_PREVIEW_SIZE;
  // Counts first, so that a page past the end can be brought back to the last one.
  const [courseTotal, chapterTotal, fileTotal] = await Promise.all([
    enabled.courses ? countCourses(plan) : null,
    enabled.chapters ? countChapters(plan) : null,
    enabled.files ? countFiles(plan) : null,
  ]);
  const totals: Record<SearchSection, number | null> = { courses: courseTotal, chapters: chapterTotal, files: fileTotal };
  const pages = show ? Math.max(1, Math.ceil((totals[show] ?? 0) / size)) : 1;
  const page = Math.min(input.page, pages);
  const offset = show ? (page - 1) * size : 0;

  const [courses, chapters, files] = await Promise.all([
    courseTotal === null ? null : group(courseTotal, () => listCourses(plan, size, offset)),
    chapterTotal === null ? null : group(chapterTotal, () => listChapters(plan, size, offset)),
    fileTotal === null ? null : group(fileTotal, () => listFiles(plan, size, offset)),
  ]);
  return { ...outcome, show, courses, chapters, files, page, pages };
}

async function group<T>(total: number, list: () => Promise<T[]>): Promise<SearchGroup<T>> {
  return { total, items: total === 0 ? [] : await list() };
}

function select<T>(sql: string, bind: Bind): Promise<T[]> {
  return getDb().sequelize.query(sql, { type: QueryTypes.SELECT, bind }) as Promise<T[]>;
}

// ----- courses

// The code form is compared as a prefix; `joined` holds only letters and digits, so it holds no
// LIKE wildcard.
const COURSE_MATCH = `(${COURSE_VECTOR} @@ ${QUERY} OR ${CODE_FORM} LIKE $joined::text || '%')`;

async function countCourses({ bind }: Plan): Promise<number> {
  const [row] = await select<{ n: number }>(`SELECT count(*)::int AS n FROM courses c WHERE ${COURSE_MATCH}`, bind);
  return row.n;
}

async function listCourses({ bind }: Plan, limit: number, offset: number): Promise<CourseHit[]> {
  const rows = await select<{
    code: string;
    title: string;
    semester: number;
    chapter_count: number;
    file_count: number;
  }>(
    `SELECT c.code, c.title, c.semester,
        (SELECT count(*)::int FROM chapters ch WHERE ch.course_id = c.id) AS chapter_count,
        (SELECT count(*)::int FROM resources r WHERE r.course_id = c.id AND r.is_published) AS file_count
      FROM courses c
      WHERE ${COURSE_MATCH}
      ORDER BY (${CODE_FORM} = $joined::text) DESC,
        (${COURSE_TITLE_VECTOR} @@ ${QUERY}) DESC,
        ts_rank(${COURSE_VECTOR}, ${QUERY}) DESC,
        c.code ASC
      LIMIT $limit::int OFFSET $offset::int`,
    { ...bind, limit, offset },
  );
  return rows.map((row) => ({
    code: row.code,
    title: row.title,
    semester: row.semester,
    chapterCount: row.chapter_count,
    fileCount: row.file_count,
  }));
}

// ----- chapters

// A chapter with no published file would be a dead end, so only chapters with one are listed.
const CHAPTER_FROM = `chapters ch
  JOIN courses c ON c.id = ch.course_id
  JOIN (SELECT chapter_id, count(*)::int AS n FROM resources WHERE is_published AND chapter_id IS NOT NULL GROUP BY chapter_id) fc
    ON fc.chapter_id = ch.id`;

async function countChapters({ bind }: Plan): Promise<number> {
  const [row] = await select<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${CHAPTER_FROM} WHERE ${CHAPTER_VECTOR} @@ ${QUERY}`,
    bind,
  );
  return row.n;
}

async function listChapters({ bind }: Plan, limit: number, offset: number): Promise<ChapterHit[]> {
  const rows = await select<{ position: number; title: string; code: string; course_title: string; n: number }>(
    `SELECT ch.position, ch.title, c.code, c.title AS course_title, fc.n
      FROM ${CHAPTER_FROM}
      WHERE ${CHAPTER_VECTOR} @@ ${QUERY}
      ORDER BY ts_rank(${CHAPTER_VECTOR}, ${QUERY}) DESC, c.code ASC, ch.position ASC
      LIMIT $limit::int OFFSET $offset::int`,
    { ...bind, limit, offset },
  );
  return rows.map((row) => ({
    position: row.position,
    title: row.title,
    courseCode: row.code,
    courseTitle: row.course_title,
    fileCount: row.n,
  }));
}

// ----- files

// Published files whose title or description holds every word, and which pass the filters taken
// from the words of the query and from the chip. The values are bound, never written into the SQL.
function fileWhere({ hasText, fileTypes, parsed }: Plan, bind: Bind): string {
  const conditions = ["r.is_published"];
  if (hasText) conditions.push(`${FILE_VECTOR} @@ ${QUERY}`);
  if (fileTypes) {
    bind.types = fileTypes;
    conditions.push("r.type = ANY($types::text[])");
  }
  if (parsed.sessions.length > 0) {
    bind.sessions = parsed.sessions;
    conditions.push("r.exam_session = ANY($sessions::text[])");
  }
  if (parsed.year !== null) {
    bind.year = parsed.year;
    conditions.push("r.academic_year_start = $year::int");
  }
  return conditions.join(" AND ");
}

async function countFiles(plan: Plan): Promise<number> {
  const bind: Bind = { ...plan.bind };
  const where = fileWhere(plan, bind);
  const [row] = await select<{ n: number }>(`SELECT count(*)::int AS n FROM resources r WHERE ${where}`, bind);
  return row.n;
}

async function listFiles(plan: Plan, limit: number, offset: number): Promise<FileHit[]> {
  const bind: Bind = { ...plan.bind, limit, offset };
  const where = fileWhere(plan, bind);
  // Title matches come before description-only matches, then relevance, then newest exams first.
  const relevance = plan.hasText
    ? `(${FILE_TITLE_VECTOR} @@ ${QUERY}) DESC, ts_rank(${FILE_VECTOR}, ${QUERY}) DESC,`
    : "";
  const rows = await select<{ id: string }>(
    `SELECT r.id
      FROM resources r JOIN courses c ON c.id = r.course_id
      WHERE ${where}
      ORDER BY ${relevance}
        (CASE WHEN r.type = 'exam' THEN r.academic_year_start END) DESC NULLS LAST,
        r.title ASC, c.code ASC, r.id ASC
      LIMIT $limit::int OFFSET $offset::int`,
    bind,
  );
  const ids = rows.map((row) => row.id);

  const { Resource, Course, Chapter } = getDb();
  const [resources, solutions] = await Promise.all([
    Resource.findAll({
      where: { id: ids },
      include: [
        { model: Course, as: "course", attributes: ["id", "code"], required: true },
        { model: Chapter, as: "chapter", attributes: ["position"], required: false },
      ],
    }),
    visibleSolutionsOf(null, ids),
  ]);
  const withChapters = new Set(
    (await Chapter.findAll({ where: { courseId: resources.map((r) => r.courseId) }, attributes: ["courseId"], group: ["courseId"], raw: true })).map(
      (row) => String(row.courseId),
    ),
  );
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return ids.flatMap((id) => {
    const resource = byId.get(id);
    if (!resource) return [];
    return [
      {
        resource: toResourceListItem(resource, resource.course!.code, solutions.get(id) ?? []),
        chapterPosition: resource.chapter?.position ?? null,
        courseHasChapters: withChapters.has(String(resource.courseId)),
      },
    ];
  });
}
