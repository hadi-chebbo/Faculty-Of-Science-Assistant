// Generates the UniMate brand images in src/app from one drawing of the mark:
// icon.svg (transparent), favicon.ico (16, 32, 48), apple-icon.png (180, white),
// opengraph-image.png and twitter-image.png (1200x630).
// The outputs are committed; run this only when the mark changes, then commit what it writes.
//
//   GEIST_FONTS=/path/to/geist-sans node scripts/generate-brand-images.mjs
//
// GEIST_FONTS is a folder holding Geist-Bold.ttf and Geist-Medium.ttf (from the `geist` npm package,
// dist/fonts/geist-sans; not a dependency of the app). sharp and next/og come with Next.js.
// The mark is the same drawing as src/components/brand/brand-mark.tsx; keep them in step.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og.js";
import sharp from "sharp";

const OUT = new URL("../src/app/", import.meta.url).pathname;
const FONTS = process.env.GEIST_FONTS;
if (!FONTS) throw new Error("Set GEIST_FONTS to the folder holding Geist-Bold.ttf and Geist-Medium.ttf");

const BLUE = "#3E4EB8";
const PALE = "#C9D1FF";
const YELLOW = "#FDB91F";

const TILES =
  '<g transform="translate(30 1.5) skewY(9) translate(-30 0)">' +
  '<rect x="5" y="9" width="25" height="22" rx="6" fill="#0EA5E9"/>' +
  '<rect x="5" y="34" width="25" height="22" rx="6" fill="#10B981"/></g>' +
  '<g transform="translate(34 1.5) skewY(-9) translate(-34 0)">' +
  '<rect x="34" y="9" width="25" height="22" rx="6" fill="#8B5CF6"/>' +
  '<rect x="34" y="34" width="25" height="22" rx="6" fill="#F59E0B"/></g>';

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;
const MARK = svg(TILES);
// The mark on a white rounded plate, for blue backgrounds.
const PLATED = svg(`<rect width="64" height="64" rx="15" fill="#FFFFFF"/><g transform="translate(8 8) scale(0.75)">${TILES}</g>`);
// Full-bleed white square for the home-screen icon (iOS rounds the corners itself).
const APPLE = svg(`<rect width="64" height="64" fill="#FFFFFF"/><g transform="translate(9 9) scale(0.72)">${TILES}</g>`);

const png = (source, size) => sharp(Buffer.from(source), { density: 72 * (size / 64) * 4 }).resize(size, size).png().toBuffer();

// An .ico holding PNG images (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// The link-preview card, laid out and rendered by next/og (the renderer Next uses for image routes),
// so the text is real Geist.
const el = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

async function openGraph() {
  const markSrc = `data:image/png;base64,${(await png(PLATED, 264)).toString("base64")}`;
  const card = el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: "100%",
      height: "100%",
      padding: 88,
      background: BLUE,
      color: "#FFFFFF",
      fontFamily: "Geist",
    },
    [
      el("div", { display: "flex", alignItems: "center", gap: 36 }, [
        el("img", { width: 132, height: 132 }, undefined, { src: markSrc, width: 132, height: 132 }),
        el("div", { display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: -3 }, [
          el("span", {}, "Uni"),
          el("span", { color: PALE }, "Mate"),
        ]),
      ]),
      el("div", { display: "flex", flexDirection: "column", gap: 28 }, [
        el("div", { width: 88, height: 10, borderRadius: 5, background: YELLOW }),
        el("div", { fontSize: 40, fontWeight: 500 }, "Lectures, notes and previous exams, in one place."),
      ]),
    ],
  );
  const res = new ImageResponse(card, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Geist", data: readFileSync(join(FONTS, "Geist-Bold.ttf")), weight: 700 },
      { name: "Geist", data: readFileSync(join(FONTS, "Geist-Medium.ttf")), weight: 500 },
    ],
  });
  return Buffer.from(await res.arrayBuffer());
}

writeFileSync(join(OUT, "icon.svg"), MARK + "\n");
writeFileSync(
  join(OUT, "favicon.ico"),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(MARK, size) })))),
);
writeFileSync(join(OUT, "apple-icon.png"), await png(APPLE, 180));
const og = await openGraph();
writeFileSync(join(OUT, "opengraph-image.png"), og);
writeFileSync(join(OUT, "twitter-image.png"), og);
console.log(`Wrote icon.svg, favicon.ico, apple-icon.png, opengraph-image.png and twitter-image.png to ${OUT}`);
