import { cn } from "@/lib/utils";

// The UniMate mark: four rounded tiles in the year colours (first sky, second violet, third emerald,
// Master 1 amber), each column tilted like one half of an open book. It has no background of its own,
// so it sits on any surface; on the deep-blue brand panel pass `plate` to put it on a small white square.
// Same drawing as src/app/icon.svg and scripts/generate-brand-images.mjs; keep them in step.
function Tiles() {
  return (
    <>
      <g transform="translate(30 1.5) skewY(9) translate(-30 0)">
        <rect x="5" y="9" width="25" height="22" rx="6" fill="#0EA5E9" />
        <rect x="5" y="34" width="25" height="22" rx="6" fill="#10B981" />
      </g>
      <g transform="translate(34 1.5) skewY(-9) translate(-34 0)">
        <rect x="34" y="9" width="25" height="22" rx="6" fill="#8B5CF6" />
        <rect x="34" y="34" width="25" height="22" rx="6" fill="#F59E0B" />
      </g>
    </>
  );
}

export function BrandMark({ className, plate = false }: { className?: string; plate?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={cn("size-7 shrink-0", className)}>
      {plate ? (
        <>
          <rect width="64" height="64" rx="15" fill="#FFFFFF" />
          <g transform="translate(8 8) scale(0.75)">
            <Tiles />
          </g>
        </>
      ) : (
        <Tiles />
      )}
    </svg>
  );
}

// The two-tone wordmark: "Uni" in the surrounding text colour, "Mate" in the link colour (deep blue in
// light, light blue in dark). `reversed` is for the deep-blue brand panel: white and pale blue.
// Screen readers read the two spans as one word, "UniMate".
export function Wordmark({ reversed = false }: { reversed?: boolean }) {
  return (
    <span className="font-semibold tracking-tight">
      Uni<span className={reversed ? "text-brand-panel-accent" : "text-link"}>Mate</span>
    </span>
  );
}
