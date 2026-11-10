export interface SavedLecturer {
  id: string;
  name: string;
  slug: string;
}

// A lecturer in the admin list: fileCount counts resources that use them, drafts included.
export interface AdminLecturer extends SavedLecturer {
  fileCount: number;
}
