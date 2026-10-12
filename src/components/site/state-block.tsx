import type { LucideIcon } from "lucide-react";

// Centered block for pages and lists that have nothing to show: a muted icon, the message and
// the action(s). With a `title` it is a page-level state (the title is the page's h1);
// without one it stands in for an empty list.
export function StateBlock({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border bg-card px-4 py-10 text-center md:py-14">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      {title && <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>}
      <p className={title ? "mt-2 max-w-md" : "mt-4 max-w-md"}>{children}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
