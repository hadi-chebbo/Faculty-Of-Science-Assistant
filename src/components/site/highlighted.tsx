import type { Marked } from "@/lib/highlight";

// Text with the matched parts in bold heading colour and no background. The parts are cut from the
// text by position and rendered as React elements: nothing is ever turned into HTML.
export function Highlighted({ marked }: { marked: Marked }) {
  const { text, ranges } = marked;
  const parts: React.ReactNode[] = [];
  let position = 0;
  ranges.forEach((range, index) => {
    if (range.start > position) parts.push(text.slice(position, range.start));
    parts.push(
      <mark key={index} className="bg-transparent font-bold text-heading">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    position = range.end;
  });
  if (position < text.length) parts.push(text.slice(position));
  return (
    <>
      {marked.before && "…"}
      {parts}
      {marked.after && "…"}
    </>
  );
}
