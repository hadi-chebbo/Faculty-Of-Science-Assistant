// A lecturer as students see it beside a file.
export interface LecturerRef {
  slug: string;
  name: string;
}

// A lecturer offered in the admin's Lecturer selects.
export interface LecturerOption extends LecturerRef {
  id: string;
}

export interface SavedLecturer {
  id: string;
  name: string;
  slug: string;
}

// A lecturer in the admin list: fileCount counts resources that use them, drafts included.
export interface AdminLecturer extends SavedLecturer {
  fileCount: number;
}
