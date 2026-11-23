export const SITE_NAME = "University Assistant";
export const SITE_DESCRIPTION =
  "Study resources and previous exams for Computer Science, Faculty of Science, Lebanese University.";

// The title of a course or chapter address that does not exist (the not-found page's own title).
export const NOT_FOUND_TITLE = "Page not found";

// Browser-tab titles of the course and chapter pages, built in one place. The site name is added
// by the root layout's title template.
export function courseTitle(course: { code: string; title: string }): string {
  return `${course.code} ${course.title}`;
}

export function chapterTitle(course: { code: string }, chapter: { position: number; title: string }): string {
  return `${course.code} · Chapter ${chapter.position}: ${chapter.title}`;
}

// Metadata for a page with its own title. A page's openGraph and twitter replace the root layout's
// whole objects, so the site name, type and card are repeated here to keep the link preview complete.
export function pageMetadata(title: string) {
  return {
    title,
    openGraph: { siteName: SITE_NAME, title, description: SITE_DESCRIPTION, type: "website" as const, locale: "en" },
    twitter: { card: "summary_large_image" as const, title, description: SITE_DESCRIPTION },
  };
}
