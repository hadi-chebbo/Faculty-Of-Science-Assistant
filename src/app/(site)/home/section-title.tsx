// Section heading (h2) with the short yellow bar the site uses under titles. PageTitle renders an h1.
export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {children}
      </h2>
      <div className="mt-2.5 h-1 w-12 rounded-full bg-highlight" aria-hidden />
    </div>
  );
}
