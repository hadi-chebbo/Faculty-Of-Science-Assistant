"use client";

import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { hasSignedInHint, BAND_HEIGHT_KEY, BAND_HEIGHT_WIDE_KEY, SIGNED_IN_MARKER, saneBandHeight } from "@/lib/auth/signed-in-hint";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";
import { ProgressRing } from "@/components/site/progress-ring";
import { useProgressOverviewState } from "@/lib/progress-overview-client";
import { WeekDots } from "@/components/site/week-dots";
import { LAST_READ_KEY, readLastPage, readLastRead } from "../resources/[id]/reader-position";
import { activeDaysText, continueMeta, courseLabel, percentOf, resumeHref, resumeLabel, topCourses, type BandCourse } from "./progress-band-logic";
import { filesOf } from "@/lib/plural";
import type { ProgressOverview } from "@/services/progress/types";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const MARKER = SIGNED_IN_MARKER;
// How long the reserved space waits for the progress answer before it is given back.
const LOADING_GIVE_UP_MS = 8000;

// The slot at the top of Home's phone order. A pre-paint script marks <html data-signed-in> when the
// readable hint cookie is there; CSS (globals.css, `.home-band-slot`) then reserves the band's last
// measured height below md and shows the short hero. This component keeps that marker true: it is
// removed when the session check answers signed out or there is nothing to show (the visitor layout
// returns and the space is released), and set when a band is about to show. On a phone it also stores
// the band's height (`home:band-h`) so the next visit reserves exactly that much. The slot is empty
// for a visitor and takes no space (see the CSS). Marked `data-personal`.
export function ProgressBand() {
  const { status, data } = useProgressOverviewState();
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (status === "ready") root.setAttribute(MARKER, "1");
    else if (status === "none") root.removeAttribute(MARKER);
    else {
      // Still loading: if the answer never comes (a failed session or ids request leaves the viewer
      // unknown), release the reserved space rather than keep an empty gap at the top of Home.
      const timer = window.setTimeout(() => root.removeAttribute(MARKER), LOADING_GIVE_UP_MS);
      return () => window.clearTimeout(timer);
    }
  }, [status]);

  // Signing in or out in this tab: follow the cookie, which the response has already changed.
  useEffect(() => {
    const follow = () => {
      if (hasSignedInHint(document.cookie)) document.documentElement.setAttribute(MARKER, "1");
      else document.documentElement.removeAttribute(MARKER);
    };
    window.addEventListener(SESSION_CHANGED_EVENT, follow);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, follow);
  }, []);

  useEffect(() => {
    const band = slot.current?.firstElementChild;
    if (status !== "ready" || !band || !(band instanceof HTMLElement)) return;
    const phone = window.matchMedia("(max-width: 767px)");
    const measure = () => {
      // Below md and from md up the card has different heights, each stored for its own reservation.
      const key = phone.matches ? BAND_HEIGHT_KEY : BAND_HEIGHT_WIDE_KEY;
      const height = Math.round(band.getBoundingClientRect().height);
      try {
        if (saneBandHeight(String(height)) !== null && localStorage.getItem(key) !== String(height)) {
          localStorage.setItem(key, String(height));
        }
      } catch {
        // Storage blocked: the next visit just uses the default height.
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    return () => observer.disconnect();
  }, [status]);

  return (
    <div ref={slot} data-personal data-testid="home-band-slot" className="home-band-slot">
      {data && <Band overview={data} />}
    </div>
  );
}

// The remembered file is read from localStorage in the browser only (no server value, so no mismatch);
// the raw text is the snapshot so it stays stable between renders.
function subscribeLastRead(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(SESSION_CHANGED_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(SESSION_CHANGED_EVENT, notify);
  };
}
function lastReadSnapshot(): string | null {
  try {
    return localStorage.getItem(LAST_READ_KEY);
  } catch {
    return null;
  }
}

// One card: where to continue reading (a position only, never progress), this week's active days and, under
// a rule, the courses with files marked as done. Nothing here is derived from opening a file.
function Band({ overview }: { overview: ProgressOverview }) {
  const raw = useSyncExternalStore(subscribeLastRead, lastReadSnapshot, () => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `raw` is the change signal for the stored record.
  const last = useMemo(() => readLastRead(), [raw]);
  const page = last ? readLastPage(last.id) : null;
  const courses = topCourses(overview.courses);
  const empty = overview.courses.length === 0;
  return (
    <section data-personal aria-labelledby="home-continue-title" className="rounded-3xl border bg-card p-5">
      <h2 id="home-continue-title" className="text-xs font-semibold uppercase tracking-wide text-link">
        Continue where you left off
      </h2>
      {last ? (
        <div data-testid="home-continue" className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="line-clamp-2 text-lg font-bold text-heading">{last.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{continueMeta(last, page)}</p>
          </div>
          <Link
            href={resumeHref(last.id, page)}
            aria-label={resumeLabel(last.title, page)}
            className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${FOCUS}`}
          >
            <Play aria-hidden className="size-4 fill-current" /> Resume
          </Link>
        </div>
      ) : (
        <p data-testid="home-continue" className="mt-2 text-sm text-muted-foreground">
          Open any file and you can pick it up here next time.
        </p>
      )}

      {overview.hasCompletions && (
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
          <WeekDots week={overview.week} className="w-full max-w-72 shrink-0" />
          <p className="text-sm">{activeDaysText(overview.week.activeDays.length)}</p>
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-progress-title" className="text-base font-semibold text-heading">
            Your progress
          </h2>
          {!empty && (
            <Link
              href="/progress"
              className={`-my-2 -mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-sm font-medium text-link hover:underline ${FOCUS}`}
            >
              See all <ChevronRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
        {empty ? (
          <p className="mt-1 text-sm text-muted-foreground">Mark files as done in the reader to track your progress here.</p>
        ) : (
          <ul className="mt-3 grid gap-1 md:grid-cols-3 md:gap-3">
            {courses.map((c) => (
              <li key={c.code} className="min-w-0">
                <CourseRow course={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CourseRow({ course: c }: { course: BandCourse }) {
  const examsOnly = c.course.total === 0;
  return (
    <Link
      href={`/courses/${c.code}`}
      aria-label={courseLabel(c)}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted md:border md:px-3 md:py-2.5 ${FOCUS}`}
    >
      <ProgressRing done={c.course.done} total={c.course.total} size={52} />
      <span className="block min-w-0 flex-1 text-sm">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[0.8125rem] font-medium text-link">{c.code}</span>
          <span className="truncate font-medium text-heading">{c.title}</span>
        </span>
        <span className="block truncate text-[0.8125rem] text-muted-foreground">
          {examsOnly ? (
            `Exams: ${c.exams.done} of ${c.exams.total} done`
          ) : c.course.finished ? (
            <span className="font-semibold text-success">✓ Finished</span>
          ) : (
            `${filesOf(c.course.done, c.course.total)} · ${percentOf(c.course.done, c.course.total)}%`
          )}
        </span>
      </span>
    </Link>
  );
}
