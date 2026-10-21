"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/report";

// Replaces the root layout when it fails, so it brings its own <html> and <body>, and no styles.
// Deliberately shows no error details.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "3rem 1rem", textAlign: "center" }}>
        <main>
          <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
          <p>Something went wrong on our side. Please try again.</p>
          <button type="button" onClick={() => retry()} style={{ fontSize: "1rem", padding: "0.6rem 1.2rem" }}>
              Try again
          </button>
        </main>
      </body>
    </html>
  );
}
