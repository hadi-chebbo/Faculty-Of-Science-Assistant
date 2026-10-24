"use client";

// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
// Question: how do Save and "Add to to-do" look on resource rows, on /saved and in the reader?
// Two variants, switchable with ?variant=A|B. Data is fake and lives in memory.
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  ListPlus,
  ListTodo,
  Maximize,
  MoreHorizontal,
  NotebookText,
  PencilLine,
  Presentation,
  Search,
  TableOfContents,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/site/page-title";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Row = { id: string; title: string; courseCode: string; courseTitle: string; type: keyof typeof ICONS; year?: string };
const ICONS = { Lecture: Presentation, Notes: NotebookText, Exercise: PencilLine, Exam: ClipboardCheck };

const COURSE_ROWS: Row[] = [
  { id: "r1", title: "Demo lecture 1 – Placeholder sorting", courseCode: "DEMO 301", courseTitle: "Placeholder Algorithms", type: "Lecture" },
  { id: "r2", title: "Sample exercises set 2", courseCode: "DEMO 301", courseTitle: "Placeholder Algorithms", type: "Exercise" },
  { id: "r5", title: "Demo lecture 2 – Fake graphs", courseCode: "DEMO 301", courseTitle: "Placeholder Algorithms", type: "Lecture" },
];
const OTHER_SAVED: Row[] = [
  { id: "r3", title: "Fake final exam", courseCode: "TEST 302", courseTitle: "Sample Databases", type: "Exam", year: "2024-2025" },
  { id: "r4", title: "Placeholder notes – chapter 3", courseCode: "TEST 302", courseTitle: "Sample Databases", type: "Notes" },
];

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const node = message && (
    <div role="status" className="fixed bottom-36 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg md:bottom-20">
      {message}
      {message.startsWith("Added") && (
        <Link href="/prototype/todo" className="font-medium underline underline-offset-4">
          View board
        </Link>
      )}
    </div>
  );
  return { show: setMessage, node };
}

// A copy of the real ResourceRow's look, with the variant's extra control on the right.
function RowShell({ row, showCourse, children }: { row: Row; showCourse?: boolean; children: React.ReactNode }) {
  const Icon = ICONS[row.type];
  return (
    <li className="group/row flex items-stretch overflow-hidden rounded-lg border bg-card hover:border-primary/40">
      <Link href="#reader" className="flex min-w-0 flex-1 items-start gap-3 p-3 hover:bg-muted/60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-link">
          <Icon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-heading">
            {showCourse && <span className="mr-2 font-mono text-xs text-link">{row.courseCode}</span>}
            {row.title}
          </span>
          <span className="mt-1.5 flex gap-1.5">
            <Badge variant="outline">English</Badge>
            {row.year && <Badge variant="secondary">{row.year}</Badge>}
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </Link>
      <div className="flex items-center border-l px-1">{children}</div>
    </li>
  );
}

function SaveIcon({ saved, toggle, title }: { saved: boolean; toggle: () => void; title: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 md:size-9"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      onClick={toggle}
    >
      {saved ? <BookmarkCheck className="size-5 fill-current text-link" /> : <Bookmark className="size-5 text-muted-foreground" />}
    </Button>
  );
}

function RowMenu({ saved, toggle, addTodo, title }: { saved: boolean; toggle: () => void; addTodo: () => void; title: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Actions for ${title}`}>
          {saved ? <BookmarkCheck className="size-5 fill-current text-link" /> : <MoreHorizontal className="size-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={toggle}>
          {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Remove from saved" : "Save for later"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={addTodo}>
          <ListPlus /> Add to to-do
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReaderMock({ saved, toggle, addTodo }: { saved: boolean; toggle: () => void; addTodo: () => void }) {
  return (
    <div id="reader" className="grid gap-4 md:grid-cols-[1fr_15rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-2">
          <Button variant="ghost" className="h-11 md:h-9">
            <TableOfContents /> Contents
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label="Search in document">
              <Search />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Fit width</DropdownMenuItem>
                <DropdownMenuItem>Fit page</DropdownMenuItem>
                <DropdownMenuItem>
                  <Maximize /> Focus mode
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={toggle}>
                  {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Remove from saved" : "Save for later"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={addTodo}>
                  <ListPlus /> Add to to-do
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Download /> Download
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ExternalLink /> Open outside the reader
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex h-72 items-center justify-center bg-muted">
          <div className="h-60 w-44 rounded bg-card shadow-sm" aria-label="PDF page placeholder" />
        </div>
      </div>
      <aside className="text-sm">
        <div className="flex flex-col gap-2">
          <Button variant={saved ? "secondary" : "outline"} className="h-11 justify-start" aria-pressed={saved} onClick={toggle}>
            {saved ? <BookmarkCheck className="fill-current text-link" /> : <Bookmark />} {saved ? "Saved" : "Save for later"}
          </Button>
          <Button variant="outline" className="h-11 justify-start" onClick={addTodo}>
            <ListPlus /> Add to to-do
          </Button>
        </div>
        <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</h3>
        <p className="mt-1">DEMO 301 · Placeholder Algorithms</p>
        <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chapter</h3>
        <p className="mt-1">1 · Fake sorting</p>
      </aside>
    </div>
  );
}

export function SavedPrototype() {
  const variant = useSearchParams().get("variant") ?? "A";
  const [saved, setSaved] = useState<Set<string>>(new Set(["r2", "r3", "r4"]));
  const toast = useToast();
  const all = [...COURSE_ROWS, ...OTHER_SAVED];
  const toggle = (row: Row) => () => {
    setSaved((s) => {
      const next = new Set(s);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
    toast.show(saved.has(row.id) ? "Removed from saved" : "Saved. Find it under Saved in your account menu.");
  };
  const addTodo = () => toast.show("Added to To do ·");

  const control = (row: Row) =>
    variant === "A" ? (
      <SaveIcon saved={saved.has(row.id)} toggle={toggle(row)} title={row.title} />
    ) : (
      <RowMenu saved={saved.has(row.id)} toggle={toggle(row)} addTodo={addTodo} title={row.title} />
    );

  const savedRows = all.filter((r) => saved.has(r.id));
  const byCourse = [...new Set(savedRows.map((r) => r.courseCode))];

  return (
    <main className="mx-auto w-full max-w-[55rem] px-4 py-6 md:py-8">
      <p className="mb-6 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Prototype. Three screens on one page: a course page list, the Saved page, and the reader. Saved now:{" "}
        <code>{JSON.stringify([...saved])}</code>
      </p>

      <h2 className="mb-1 text-lg font-semibold text-heading">1 · On a course page (signed in)</h2>
      <p className="mb-3 text-sm text-muted-foreground">DEMO 301 · Chapter 1</p>
      <ul className="flex flex-col gap-2">{COURSE_ROWS.map((row) => <RowShell key={row.id} row={row}>{control(row)}</RowShell>)}</ul>

      <div className="my-10 border-t" />

      <h2 className="mb-4 text-lg font-semibold text-heading">2 · The Saved page (/saved)</h2>
      <PageTitle description="Files you kept to come back to. Only you can see them.">Saved</PageTitle>
      {savedRows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm">
          <Bookmark className="mx-auto mb-2 size-6 text-muted-foreground" />
          Nothing saved yet. Tap the bookmark on any file to keep it here.
          <div className="mt-4">
            <Button asChild variant="outline" className="h-11">
              <Link href="#">Browse courses</Link>
            </Button>
          </div>
        </div>
      ) : (
        byCourse.map((code) => {
          const rows = savedRows.filter((r) => r.courseCode === code);
          return (
            <section key={code} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-heading">
                <span className="font-mono text-link">{code}</span> · {rows[0].courseTitle}
              </h3>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <RowShell key={row.id} row={row}>
                    {variant === "A" ? (
                      <>
                        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Add ${row.title} to to-do`} onClick={addTodo}>
                          <ListTodo className="size-5" />
                        </Button>
                        {control(row)}
                      </>
                    ) : (
                      control(row)
                    )}
                  </RowShell>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <div className="my-10 border-t" />

      <h2 className="mb-4 text-lg font-semibold text-heading">3 · The reader (Save in More actions and the details column)</h2>
      <ReaderMock saved={saved.has("r1")} toggle={toggle(COURSE_ROWS[0])} addTodo={addTodo} />

      {toast.node}
      <PrototypeSwitcher
        variants={[
          { key: "A", name: "Bookmark icon on rows" },
          { key: "B", name: "Row menu" },
        ]}
      />
    </main>
  );
}
