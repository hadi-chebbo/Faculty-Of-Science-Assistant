export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAge(from: Date, now: Date): string {
  const hours = Math.floor((now.getTime() - from.getTime()) / (60 * 60 * 1000));
  if (hours < 48) return `${Math.max(hours, 1)} ${hours === 1 ? "hour" : "hours"} ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// "resources/3f2a1c9e-....pdf" shortened in the middle, so rows stay on one line on a phone.
export function shortenKey(key: string): string {
  return key.length <= 28 ? key : `${key.slice(0, 16)}…${key.slice(-10)}`;
}
