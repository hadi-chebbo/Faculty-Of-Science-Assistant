import { Check } from "lucide-react";
import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/brand-mark";

const PANEL_POINTS = ["Course material by chapter", "Previous exams", "A reader for every file"];

// The content of the AuthShell panel, shared by every account screen so they look like one family.
export function BrandPanel() {
  return (
    <>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-3 rounded-md text-xl outline-none focus-visible:ring-[3px] focus-visible:ring-brand-panel-foreground/50"
      >
        <BrandMark plate className="size-9" />
        <Wordmark reversed />
      </Link>
      <p className="mt-6 text-balance text-2xl font-bold leading-tight">
        Every course, chapter and past exam in one place.
      </p>
      <ul className="mt-8 space-y-3 text-[0.9375rem]">
        {PANEL_POINTS.map((point) => (
          <li key={point} className="flex items-center gap-2.5">
            <Check className="size-4 shrink-0" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
    </>
  );
}
