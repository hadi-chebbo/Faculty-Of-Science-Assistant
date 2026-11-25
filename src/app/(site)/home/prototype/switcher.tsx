"use client";
// PROTOTYPE (throwaway): floating bar that cycles ?variant= on the home route. Dev only.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export const VARIANTS = [
  { key: "current", name: "Current home" },
  { key: "D", name: "Dashboard" },
  { key: "E", name: "Playful" },
] as const;

export function PrototypeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? "current";
  const index = Math.max(0, VARIANTS.findIndex((v) => v.key === current));

  const go = useCallback(
    (delta: number) => {
      const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
      router.replace(`${pathname}?variant=${next.key}`, { scroll: false });
    },
    [index, pathname, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.matches("input, textarea") || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-3 py-2 text-sm text-white shadow-2xl">
      <button aria-label="Previous variant" onClick={() => go(-1)} className="rounded-full p-1.5 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-44 text-center font-medium">
        {VARIANTS[index].key} · {VARIANTS[index].name}
      </span>
      <button aria-label="Next variant" onClick={() => go(1)} className="rounded-full p-1.5 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
