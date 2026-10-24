import Link from "next/link";
import { DISCLAIMER } from "@/components/site/site-footer";
import { ThemeToggle } from "@/components/site/theme-toggle";

// Own layout for the account pages: a slim bar (brand and theme toggle only), the card
// centred, and the disclaimer under it. No navigation, account control or phone tab bar.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight text-heading">
            University Assistant
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 flex-col md:justify-center">
        {children}
        <footer className="px-4 pb-8 text-center text-sm text-muted-foreground">
          {DISCLAIMER}
        </footer>
      </div>
    </>
  );
}
