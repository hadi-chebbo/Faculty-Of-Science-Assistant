import type { ResourceType } from "@/db/constants";
import type { Year } from "./years";

// The shared design language, defined once. Every page takes its year colour and its file-type colour from
// here; no page hard-codes its own. Class names are written out in full so Tailwind finds them.
//
// Year: first sky, second violet, third emerald, Master 1 amber.
//  - solid:  a filled circle or tab (text colour chosen for contrast)
//  - chip:   a tinted chip or icon box with dark text in light mode and light text in dark mode
//  - border: the hover border of a card
// File type: lecture blue, notes teal, exercise orange, exam rose; solutions and other stay neutral.
// Colour is never the only signal: the year label and the type name are always shown beside it.
export interface YearStyle {
  solid: string;
  chip: string;
  border: string;
}

export const YEAR_STYLES: Record<Year, YearStyle> = {
  1: {
    solid: "bg-sky-700 text-white",
    chip: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
    border: "hover:border-sky-500/70",
  },
  2: {
    solid: "bg-violet-600 text-white",
    chip: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
    border: "hover:border-violet-500/70",
  },
  3: {
    solid: "bg-emerald-700 text-white",
    chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    border: "hover:border-emerald-500/70",
  },
  4: {
    solid: "bg-amber-400 text-black",
    chip: "bg-amber-500/20 text-amber-900 dark:text-amber-300",
    border: "hover:border-amber-500/70",
  },
};

export interface TypeStyle {
  chip: string;
}

const NEUTRAL_TYPE: TypeStyle = { chip: "bg-muted text-link" };

export const TYPE_STYLES: Record<ResourceType, TypeStyle> = {
  lecture: { chip: "bg-blue-500/15 text-blue-800 dark:text-blue-300" },
  notes: { chip: "bg-teal-500/15 text-teal-800 dark:text-teal-300" },
  exercise: { chip: "bg-orange-500/15 text-orange-800 dark:text-orange-300" },
  exam: { chip: "bg-rose-500/15 text-rose-800 dark:text-rose-300" },
  solution: NEUTRAL_TYPE,
  other: NEUTRAL_TYPE,
};
