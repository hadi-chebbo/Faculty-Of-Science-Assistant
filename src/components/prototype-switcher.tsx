"use client";

// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? variants[0].key;
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  function go(step: number) {
    const next = variants[(index + step + variants.length) % variants.length];
    const query = new URLSearchParams(params);
    query.set("variant", next.key);
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-40 flex whitespace-nowrap -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1 text-sm text-white shadow-xl md:bottom-6">
      <button type="button" onClick={() => go(-1)} className="rounded-full p-2 hover:bg-white/20" aria-label="Previous variant">
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 font-mono">
        {variants[index].key} ({variants[index].name})
      </span>
      <button type="button" onClick={() => go(1)} className="rounded-full p-2 hover:bg-white/20" aria-label="Next variant">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
