import { describe, expect, it } from "vitest";
import {
  ZOOM_LEVELS,
  canvasPixelRatio,
  clampPage,
  fitPagePercent,
  fitWidthPercent,
  pageCssSize,
  parsePageInput,
  stepZoom,
} from "./reader-zoom";

describe("stepZoom", () => {
  it("moves between the levels", () => {
    expect(stepZoom(100, 1)).toBe(110);
    expect(stepZoom(100, -1)).toBe(90);
    expect(stepZoom(125, 1)).toBe(150);
    expect(stepZoom(125, -1)).toBe(110);
  });

  it("steps from a value between levels to the next one in that direction", () => {
    expect(stepZoom(117.4, 1)).toBe(125);
    expect(stepZoom(117.4, -1)).toBe(110);
    expect(stepZoom(51, 1)).toBe(67);
  });

  it("treats a value that is almost a level as that level", () => {
    expect(stepZoom(100.2, 1)).toBe(110);
    expect(stepZoom(99.8, -1)).toBe(90);
  });

  it("stays at the ends", () => {
    expect(stepZoom(300, 1)).toBe(300);
    expect(stepZoom(50, -1)).toBe(50);
    expect(stepZoom(400, 1)).toBe(300);
    expect(stepZoom(20, -1)).toBe(20);
    expect(stepZoom(44, -1)).toBe(44);
    expect(stepZoom(20, 1)).toBe(50);
  });

  it("zooming in always lands on a level, and zooming out never makes the page bigger", () => {
    for (let p = 10; p <= 450; p += 3.7) {
      expect(ZOOM_LEVELS).toContain(stepZoom(p, 1));
      expect(stepZoom(p, -1)).toBeLessThanOrEqual(p);
    }
  });
});

describe("fit scales", () => {
  // An A4 page is 595 x 842 points: 793 x 1123 CSS pixels at 100%.
  it("fit width makes the page exactly as wide as the area", () => {
    const percent = fitWidthPercent(1000, 595);
    expect(pageCssSize(595, 842, percent).width).toBe(1000);
  });

  it("fit page is limited by the height when the area is short", () => {
    const percent = fitPagePercent(1000, 500, 595, 842);
    expect(pageCssSize(595, 842, percent).height).toBe(500);
    expect(percent).toBeLessThan(fitWidthPercent(1000, 595));
  });

  it("fit page is limited by the width when the area is tall", () => {
    expect(fitPagePercent(400, 5000, 595, 842)).toBeCloseTo(fitWidthPercent(400, 595), 5);
  });

  it("stays within sane bounds and survives nonsense", () => {
    expect(fitWidthPercent(10, 595)).toBe(25);
    expect(fitWidthPercent(100_000, 595)).toBe(400);
    expect(fitWidthPercent(0, 595)).toBe(100);
    expect(fitWidthPercent(Number.NaN, 595)).toBe(100);
  });
});

describe("pageCssSize", () => {
  it("shows 100% at the PDF's real size", () => {
    expect(pageCssSize(595, 842, 100)).toEqual({ width: 793, height: 1123 });
    expect(pageCssSize(595, 842, 50)).toEqual({ width: 397, height: 561 });
  });
});

describe("canvasPixelRatio", () => {
  it("uses the screen ratio up to the cap", () => {
    expect(canvasPixelRatio(800, 1100, 1)).toBe(1);
    expect(canvasPixelRatio(800, 1100, 3)).toBe(2);
    expect(canvasPixelRatio(800, 1100, 0)).toBe(1);
  });

  it("lowers the ratio for a huge page so the canvas stays bounded", () => {
    const ratio = canvasPixelRatio(2400, 3400, 2);
    expect(ratio).toBeLessThan(2);
    expect(2400 * ratio * 3400 * ratio).toBeLessThanOrEqual(16_000_001);
  });
});

describe("parsePageInput", () => {
  it("accepts whole numbers inside the file", () => {
    expect(parsePageInput("3", 12)).toBe(3);
    expect(parsePageInput(" 12 ", 12)).toBe(12);
    expect(parsePageInput("1", 1)).toBe(1);
  });

  it("rejects everything else", () => {
    for (const text of ["", " ", "0", "13", "-2", "2.5", "abc", "3x", "1e2", "0003x"]) {
      expect(parsePageInput(text, 12), text).toBeNull();
    }
  });
});

describe("clampPage", () => {
  it("keeps a page inside the file", () => {
    expect(clampPage(0, 12)).toBe(1);
    expect(clampPage(99, 12)).toBe(12);
    expect(clampPage(5, 12)).toBe(5);
  });
});
