import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/page-title";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


// Absolute address for the link-preview image. The app URL helper throws on a malformed APP_URL;
// a page must never fail for that, so the preview just goes without a base.
function metadataBase(): URL | undefined {
  try {
    return new URL(getAppUrl());
  } catch {
    return undefined;
  }
}

// The preview image is src/app/opengraph-image.png (and twitter-image.png), picked up by Next.js.
export function generateMetadata(): Metadata {
  return {
    metadataBase: metadataBase(),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      type: "website",
      locale: "en",
    },
    twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  };
}

// The browser bar follows the page background of each theme (the --background tokens in globals.css).
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before paint, hence suppressHydrationWarning.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
