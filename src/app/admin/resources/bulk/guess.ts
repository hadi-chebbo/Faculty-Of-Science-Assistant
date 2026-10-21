import type { ExamSession, ResourceType } from "@/db/constants";
import { RESOURCE_TITLE_MAX_LENGTH } from "@/db/constants";
import { parseSearchQuery } from "@/services/search/query";

export interface FileNameGuess {
  title: string;
  type?: ResourceType;
  examSession?: ExamSession;
  academicYearStart?: number;
}

// What a file name says about the resource, for the bulk upload table. Only a starting point: the admin
// edits every value. The title is the name made readable (casing kept, nothing removed); the type, session
// and year come from the same filter words the search page understands, so "final 2023-2024" is a final
// exam of 2023-2024 and "cours_3" a lecture. A session word makes an exam unless the name also says some
// other type.
export function guessFromFileName(name: string): FileNameGuess {
  const base = name.replace(/\.pdf$/i, "");
  // `-` between digits stays (it is a year range); every other `-` and `_` is a space.
  const spaced = base.replace(/_/g, " ").replace(/(?<!\d)-|-(?!\d)/g, " ").replace(/\s+/g, " ").trim();
  const title = Array.from(spaced).slice(0, RESOURCE_TITLE_MAX_LENGTH).join("").trim();

  const parsed = parseSearchQuery(spaced);
  const guess: FileNameGuess = { title };
  const type = parsed.types[0];
  const session = parsed.sessions[0];
  if (session && (type === undefined || type === "exam")) {
    guess.type = "exam";
    guess.examSession = session;
  } else if (type) {
    guess.type = type;
  }
  if (parsed.year !== null) guess.academicYearStart = parsed.year;
  return guess;
}
