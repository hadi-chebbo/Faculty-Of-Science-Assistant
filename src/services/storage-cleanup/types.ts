export interface AbandonedFile {
  key: string;
  size: number;
  lastModified: Date;
}

export interface AbandonedUploads {
  files: AbandonedFile[];
  totalBytes: number;
}

export interface DeleteResult {
  deleted: string[];
  skipped: string[];
}
