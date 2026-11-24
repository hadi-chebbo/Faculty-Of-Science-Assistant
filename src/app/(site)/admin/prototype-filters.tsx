"use client";
// PROTOTYPE (throwaway): three looks for searchable selects + a draft/published filter on the /admin filter bar.
// Switch with ?variant=A|B|C (arrow keys too). Not wired to the real filter; state is in memory. Delete after the pick.
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Opt { value: string; label: string; group?: string }
const VARIANTS = ["A", "B", "C"] as const;
const NAMES = { A: "Popover + segmented status", B: "Type-ahead input + status select", C: "Picker dialog (grouped) + chips" };

function useFiltered(options: Opt[], q: string) {
  return useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);
}

// A: button that opens a popover with a search box and a list.
function PopoverSelect({ label, all, options, id }: { label: string; all: string; options: Opt[]; id: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [q, setQ] = useState("");
  const list = useFiltered(options, q);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative sm:w-72">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <button id={id} type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 text-sm md:h-9">
        <span className="truncate">{current?.label ?? all}</span>
        <ChevronsUpDown className="size-4 opacity-50" aria-hidden />
      </button>
      <input type="hidden" name={id} value={value} />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`}
            className="mb-2 h-10 w-full rounded border bg-background px-2 text-sm" />
          <ul className="max-h-56 overflow-auto text-sm">
            {[{ value: "", label: all }, ...list].map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { setValue(o.value); setOpen(false); setQ(""); }}
                  className="flex min-h-10 w-full items-center justify-between rounded px-2 text-left hover:bg-muted">
                  <span>{o.label}</span>{o.value === value && <Check className="size-4" aria-hidden />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-2 py-2 text-muted-foreground">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// B: the field itself is the search box; suggestions drop under it. Looks like a text input with a clear button.
function TypeAhead({ label, all, options, id }: { label: string; all: string; options: Opt[]; id: string }) {
  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const [focus, setFocus] = useState(false);
  const list = useFiltered(options, value ? "" : text);
  return (
    <div className="relative sm:w-72">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-heading">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" aria-hidden />
        <input id={id} value={text} placeholder={all} autoComplete="off"
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 120)}
          onChange={(e) => { setText(e.target.value); setValue(""); }}
          className="h-11 w-full rounded-md border bg-background pl-8 pr-8 text-sm md:h-9" />
        {text && <button type="button" aria-label={`Clear ${label}`} onClick={() => { setText(""); setValue(""); }}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center"><X className="size-4" aria-hidden /></button>}
      </div>
      <input type="hidden" name={label} value={value} />
      {focus && !value && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {list.map((o) => (
            <li key={o.value}><button type="button" onMouseDown={() => { setText(o.label); setValue(o.value); }}
              className="min-h-10 w-full rounded px-2 text-left hover:bg-muted">{o.label}</button></li>
          ))}
          {list.length === 0 && <li className="px-2 py-2 text-muted-foreground">No match.</li>}
        </ul>
      )}
    </div>
  );
}

// C: a button opens a modal picker with search and results grouped by semester; good for long course lists on a phone.
function PickerDialog({ label, all, options, id }: { label: string; all: string; options: Opt[]; id: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [q, setQ] = useState("");
  const list = useFiltered(options, q);
  const groups = [...new Set(list.map((o) => o.group ?? ""))];
  return (
    <div className="sm:w-72">
      <span className="mb-1.5 block text-sm font-medium text-heading">{label}</span>
      <Button type="button" variant="outline" className="h-11 w-full justify-between md:h-9" onClick={() => setOpen(true)}>
        <span className="truncate">{options.find((o) => o.value === value)?.label ?? all}</span><Search aria-hidden />
      </Button>
      <input type="hidden" name={id} value={value} />
      {open && (
        <div role="dialog" aria-modal="true" aria-label={`Choose ${label}`} className="fixed inset-0 z-50 grid place-items-start bg-black/50 p-4 pt-[10vh]" onClick={() => setOpen(false)}>
          <div className="mx-auto w-full max-w-md rounded-lg bg-popover p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="mb-2 h-11 w-full rounded border bg-background px-3 text-sm" />
            <div className="max-h-[50vh] overflow-auto text-sm">
              <button type="button" onClick={() => { setValue(""); setOpen(false); }} className="min-h-11 w-full rounded px-2 text-left hover:bg-muted">{all}</button>
              {groups.map((g) => (
                <div key={g}>
                  {g && <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</p>}
                  {list.filter((o) => (o.group ?? "") === g).map((o) => (
                    <button key={o.value} type="button" onClick={() => { setValue(o.value); setOpen(false); setQ(""); }}
                      className="flex min-h-11 w-full items-center justify-between rounded px-2 text-left hover:bg-muted">{o.label}{o.value === value && <Check className="size-4" aria-hidden />}</button>
                  ))}
                </div>
              ))}
              {list.length === 0 && <p className="px-2 py-3 text-muted-foreground">No match.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS = [{ v: "", l: "All" }, { v: "published", l: "Published" }, { v: "draft", l: "Draft" }];

function Status({ kind }: { kind: "segmented" | "select" | "chips" }) {
  const [v, setV] = useState("");
  if (kind === "select")
    return (
      <div className="sm:w-40">
        <label htmlFor="proto-status" className="mb-1.5 block text-sm font-medium text-heading">Status</label>
        <select id="proto-status" name="status" value={v} onChange={(e) => setV(e.target.value)} className="h-11 w-full rounded-md border bg-background px-2 text-sm md:h-9">
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l === "All" ? "All statuses" : s.l}</option>)}
        </select>
      </div>
    );
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-heading">Status</legend>
      <input type="hidden" name="status" value={v} />
      <div className={kind === "segmented" ? "inline-flex overflow-hidden rounded-md border" : "flex gap-2"}>
        {STATUS.map((s) => (
          <button key={s.v} type="button" aria-pressed={v === s.v} onClick={() => setV(s.v)}
            className={`h-11 px-3 text-sm md:h-9 ${kind === "chips" ? "rounded-full border" : "border-r last:border-r-0"} ${v === s.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
            {s.l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const COURSES: Opt[] = ["I3301 Operating Systems|S5", "I3302 Databases II|S5", "I3305 GUI|S5", "I3401 Compilers|S6", "I3402 Networks|S6", "I3403 AI|S6", "I2201 Algorithms|S3", "I2202 Data Structures|S3", "DEMO301 Demo Algorithms|S3"]
  .map((s) => { const [label, group] = s.split("|"); return { value: label.split(" ")[0], label, group }; });
const LECTURERS: Opt[] = ["Dr. Ada Example", "Dr. Alan Sample", "Pr. Grace Placeholder", "Dr. Ali Ghorayeb"].map((n) => ({ value: n, label: n }));

export function PrototypeFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get("variant");
  const current = (VARIANTS as readonly string[]).includes(raw ?? "") ? (raw as "A" | "B" | "C") : "A";
  const go = useRef((d: number) => {});
  useEffect(() => {
    go.current = (d) => {
    const next = VARIANTS[(VARIANTS.indexOf(current) + d + VARIANTS.length) % VARIANTS.length];
    const p = new URLSearchParams(params.toString());
    p.set("variant", next);
    router.replace(`${path}?${p}`);
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowLeft") go.current(-1);
      if (e.key === "ArrowRight") go.current(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const Sel = current === "A" ? PopoverSelect : current === "B" ? TypeAhead : PickerDialog;
  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Sel id="course" label="Course" all="All courses" options={COURSES} />
        <Sel id="lecturer" label="Lecturer" all="All lecturers" options={LECTURERS} />
        <Status kind={current === "A" ? "segmented" : current === "B" ? "select" : "chips"} />
        <Button type="submit" className="h-11 px-4 md:h-9 md:px-3">Apply</Button>
      </form>
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
          <button type="button" aria-label="Previous variant" onClick={() => go.current(-1)}>←</button>
          <span>{current} ({NAMES[current]})</span>
          <button type="button" aria-label="Next variant" onClick={() => go.current(1)}>→</button>
        </div>
      )}
    </>
  );
}
