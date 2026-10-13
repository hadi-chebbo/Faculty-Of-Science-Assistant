import Link from "next/link";
import { readForPage } from "@/lib/page-errors";
import { getHomeStats } from "@/services/courses/home";
import { SectionTitle } from "./section-title";
import { semesterCardText, showStats } from "./semester-card";

// The only part of the home page that reads the database. One call feeds both the numbers strip
// and the semester cards; viewer is null because browsing needs no account.
export async function StatsAndSemesters() {
  const stats = await readForPage(() => getHomeStats(null));
  const { totals } = stats;
  const numbers = [
    { label: "Courses", value: totals.courses },
    { label: "Chapters", value: totals.chapters },
    { label: "Files to study from", value: totals.resources },
    { label: "Previous exams", value: totals.exams },
  ];

  return (
    <>
      {showStats(totals.courses) && (
        <dl className="-mt-4 grid grid-cols-2 rounded-lg border bg-card sm:grid-cols-4 md:-mt-8">
          {numbers.map(({ label, value }, i) => (
            <div
              key={label}
              className={`px-5 py-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} sm:border-l sm:first:border-l-0`}
            >
              <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
              <dd className="text-[1.625rem] font-semibold leading-tight tabular-nums text-heading">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <section id="semesters" className="scroll-mt-20">
        <SectionTitle>Choose your semester</SectionTitle>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.semesters.map((entry) => (
            <li key={entry.semester}>
              <SemesterCard entry={entry} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function SemesterCard({ entry }: { entry: { semester: number; courseCount: number; resourceCount: number } }) {
  const text = semesterCardText(entry);
  const empty = text.counts === null;
  const inner = (
    <>
      <span
        className={`self-start rounded-full px-2 py-0.5 text-xs font-medium ${
          empty ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"
        }`}
      >
        {text.tag}
      </span>
      <span className="text-[1.75rem] font-bold leading-none text-heading">
        {text.label}
        <span className="mt-1.5 block text-sm font-normal text-muted-foreground">{text.name}</span>
      </span>
      <span className="mt-auto flex justify-between gap-2 text-sm">
        <span>{text.counts ?? text.empty}</span>
        {!empty && <span className="font-medium text-link">Open</span>}
      </span>
    </>
  );
  const base = "flex h-full min-h-36 flex-col gap-3.5 rounded-xl p-4 md:p-[18px]";

  if (empty) {
    return <div className={`${base} border border-dashed text-muted-foreground`}>{inner}</div>;
  }
  return (
    <Link
      href={`/semesters/${entry.semester}`}
      className={`${base} border bg-card transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
    >
      {inner}
    </Link>
  );
}
