// A chapter as the admin sees it. A course's chapters are always numbered 1..n without gaps.
export interface AdminChapter {
  id: string;
  position: number;
  title: string;
}

// A chapter with the number of resources filed under it, drafts included.
export interface AdminChapterWithCount extends AdminChapter {
  itemCount: number;
}
