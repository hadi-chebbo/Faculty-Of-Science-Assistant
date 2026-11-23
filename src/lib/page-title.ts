// Browser-tab titles of the course and chapter pages, built in one place. The site name is added
// by the root layout's title template.
export function courseTitle(course: { code: string; title: string }): string {
  return `${course.code} ${course.title}`;
}

export function chapterTitle(course: { code: string }, chapter: { position: number; title: string }): string {
  return `${course.code} · Chapter ${chapter.position}: ${chapter.title}`;
}
