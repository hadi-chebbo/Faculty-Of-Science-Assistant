// Page heading with the short yellow bar motif used under section headings.
export function PageTitle({ children, description }: { children: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{children}</h1>
      <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
      {description && <p className="mt-3">{description}</p>}
    </div>
  );
}
