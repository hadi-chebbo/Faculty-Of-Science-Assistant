import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The shared shell of a centred state card (#189): a rounded-3xl bordered card, a 56px tinted icon box,
// the content and an optional actions area. Used by the Saved empty state and the in-page sign-in state
// (with its checking skeleton, `loading`, which draws a skeleton in the icon's place so the shell and its
// size never change). `className` carries the width (max-w-md) and `...rest` the test id or aria attributes.
export function IconCard({
  icon: Icon,
  loading = false,
  children,
  actions,
  className,
  ...rest
}: Omit<React.ComponentProps<"section">, "children"> & {
  icon: LucideIcon;
  loading?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={cn("flex flex-col items-center rounded-3xl border bg-card px-4 py-12 text-center md:px-8 md:py-16", className)}
      {...rest}
    >
      {loading ? (
        <Skeleton className="size-14 rounded-2xl" />
      ) : (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-link">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      {children}
      {actions && <div className="mt-6 flex w-full flex-col items-center">{actions}</div>}
    </section>
  );
}
