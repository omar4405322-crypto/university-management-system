/**
 * Hard limits and operational constants for text extraction runner and workers.
 *
 * SIMILARITY_MAX_INPUT_BYTES is set to 25MB (26214400 bytes), matching the
 * task submission upload limit (defined directly here to decouple similarity
 * services from upload middleware).
 */

export const SIMILARITY_WORKER_TIMEOUT_MS = 10000;
export const SIMILARITY_MAX_WORKER_MEMORY_MB = 128;
export const SIMILARITY_MAX_TEXT_SIZE_BYTES = 5242880; // 5MB limit on extracted text
export const SIMILARITY_MAX_INPUT_BYTES = 26214400; // 25MB input buffer ceiling
export const SIMILARITY_MAX_ZIP_ENTRIES = 1000;
export const SIMILARITY_MAX_ZIP_UNCOMPRESSED_BYTES = 52428800; // 50MB total uncompressed zip ceiling
