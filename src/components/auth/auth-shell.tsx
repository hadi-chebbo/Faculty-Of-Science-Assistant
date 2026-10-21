// Split layout shared by the account pages: a brand panel on md and up, the brand name
// above the form on a phone. The caller supplies the panel content and the form side.
export function AuthShell({ panel, children }: { panel: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:py-16">
      <p className="mb-6 text-center text-lg font-semibold tracking-tight text-heading md:hidden">University Assistant</p>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm md:grid md:grid-cols-[2fr_3fr]">
        <aside
          data-testid="auth-panel"
          className="relative hidden flex-col justify-center overflow-hidden bg-brand-panel p-10 text-brand-panel-foreground md:flex"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 size-64 rounded-full bg-brand-panel-foreground/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-16 size-44 rounded-full bg-brand-panel-foreground/5"
          />
          <div className="relative">{panel}</div>
        </aside>
        <div className="px-5 py-8 sm:px-8 md:px-10 md:py-12">{children}</div>
      </div>
    </div>
  );
}
