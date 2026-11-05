// Rows enriched per students.exportList call. Each row costs ~7 reads
// (enrollments, address, guardian chain), so the client fetches rows in chunks
// this size to stay under the per-query read limit.
export const EXPORT_CHUNK_SIZE = 100
