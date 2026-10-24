import Link from "next/link";

// The plain-text brand that leads home, shared by the site header and the account pages' bar.
export function BrandLink() {
  return (
    <Link href="/" className="font-semibold tracking-tight text-heading">
      University Assistant
    </Link>
  );
}
