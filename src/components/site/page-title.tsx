// Page heading with the short yellow bar motif used under section headings. Every page puts
// this directly under its breadcrumb (or at the top on phones), so spacing is the same everywhere. `leading` goes before
// the heading on the same line (the year page's year circle).
export function PageTitle({
  children,
  description,
  leading,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const heading = <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{children}</h1>;
  return (
    <div className="mb-6">
      {leading ? (
        <div className="flex items-center gap-4">
          {leading}
          {heading}
        </div>
      ) : (
        heading
      )}
      <div className="mt-3 h-1 w-12 rounded-full bg-highlight" aria-hidden />
      {description && <p className="mt-3 max-w-2xl">{description}</p>}
    </div>
  );
}
