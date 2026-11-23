// The two routes that lead to a resource's stored file, built in one place. Both redirect to a short-lived
// signed address, so link to them with a plain <a>, never next/link (which would prefetch them).
export const downloadHref = (id: string) => `/api/v1/resources/${id}/download`;
export const openHref = (id: string) => `/api/v1/resources/${id}/open`;
