// Zoom and page-number logic for the reader, kept free of React and the DOM so it can be tested.

// 100% is the PDF's real size: one PDF point is 96/72 CSS pixels.
export const CSS_PX_PER_POINT = 96 / 72;
export const ZOOM_LEVELS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300] as const;
// A fit can land outside the levels (a very narrow or very wide window); keep it sane.
const MIN_FIT_PERCENT = 25;
const MAX_FIT_PERCENT = 400;
// Canvases above this many pixels are drawn at a lower resolution: memory, not sharpness, is the limit.
const MAX_CANVAS_PIXELS = 16_000_000;
// Phones (older iPhones especially) run out of canvas memory sooner.
export const MAX_CANVAS_PIXELS_SMALL = 8_000_000;
// On a wide screen a fitted page stops growing here, so it sits centred with margins.
const WIDE_FIT_MAX_WIDTH = 880;
const WIDE_FIT_MARGIN = 48;
const NARROW_FIT_MARGIN = 32;

export type ZoomMode = { kind: "width" } | { kind: "page" } | { kind: "zoom"; percent: number };

function clampFit(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 100;
  return Math.min(MAX_FIT_PERCENT, Math.max(MIN_FIT_PERCENT, percent));
}

// The width a fitted page may take, from the width of the reading area: the whole width minus the
// margins on a phone; on a wide screen also never more than a comfortable line length.
export function fitAreaWidth(areaWidth: number, wide: boolean): number {
  const width = wide ? Math.min(areaWidth - WIDE_FIT_MARGIN, WIDE_FIT_MAX_WIDTH) : areaWidth - NARROW_FIT_MARGIN;
  return Math.max(1, width);
}

// The zoom at which a page `pagePoints` wide exactly fills `available` CSS pixels.
export function fitWidthPercent(available: number, pagePoints: number): number {
  return clampFit((available / (pagePoints * CSS_PX_PER_POINT)) * 100);
}

// The zoom at which the whole page fits the area, whichever of width and height limits it.
export function fitPagePercent(availableWidth: number, availableHeight: number, pageWidth: number, pageHeight: number): number {
  const byWidth = availableWidth / (pageWidth * CSS_PX_PER_POINT);
  const byHeight = availableHeight / (pageHeight * CSS_PX_PER_POINT);
  return clampFit(Math.min(byWidth, byHeight) * 100);
}

// The next level strictly above (or below) the current zoom, which may be a computed fit value
// between two levels. At either end it stays where it is (or, below the smallest level, where it is).
export function stepZoom(percent: number, direction: 1 | -1): number {
  const EPSILON = 0.5;
  if (direction === 1) return ZOOM_LEVELS.find((level) => level > percent + EPSILON) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const lower = ZOOM_LEVELS.filter((level) => level < percent - EPSILON);
  // Below the smallest level (a very small fit) there is nothing lower: stay.
  return lower.length > 0 ? lower[lower.length - 1] : Math.min(percent, ZOOM_LEVELS[0]);
}

// The size a page is shown at, in CSS pixels.
export function pageCssSize(pointsWidth: number, pointsHeight: number, percent: number) {
  const factor = (CSS_PX_PER_POINT * percent) / 100;
  return { width: Math.round(pointsWidth * factor), height: Math.round(pointsHeight * factor) };
}

// How many canvas pixels per CSS pixel: the screen's ratio, capped, and lowered further for huge pages.
export function canvasPixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  cap = 2,
  maxPixels = MAX_CANVAS_PIXELS,
): number {
  const wanted = Math.min(Math.max(devicePixelRatio || 1, 1), cap);
  const area = cssWidth * cssHeight;
  if (area <= 0) return wanted;
  return Math.min(wanted, Math.sqrt(maxPixels / area));
}

// A page number typed into the box: whole numbers from 1 to the page count, otherwise null.
export function parsePageInput(text: string, total: number): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return null;
  const page = Number(trimmed);
  return page >= 1 && page <= total ? page : null;
}

export function clampPage(page: number, total: number): number {
  return Math.min(total, Math.max(1, Math.round(page)));
}
