// A chapter as the admin sees it. A course's chapters are always numbered 1..n without gaps.
export interface AdminChapter {
  id: string;
  position: number;
  title: string;
}
