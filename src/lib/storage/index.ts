import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export type StoredFile = {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateUpload(mimeType: string, sizeBytes: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes`);
  }
}

function localRoot(): string {
  return process.env.STORAGE_LOCAL_PATH || "./storage";
}

/**
 * Storage abstraction — local filesystem now, S3/R2-compatible later.
 */
export async function storeFile(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  validateUpload(params.mimeType, params.buffer.byteLength);

  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider !== "local") {
    throw new Error(`Storage provider "${provider}" is not configured yet. Use local.`);
  }

  const ext = path.extname(params.originalName) || "";
  const safeBase = path
    .basename(params.originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${ext}`;
  const folderPath = path.join(localRoot(), params.folder);
  await mkdir(folderPath, { recursive: true });
  const fullPath = path.join(folderPath, storedName);
  await writeFile(fullPath, params.buffer);

  return {
    fileName: params.originalName,
    filePath: path.join(params.folder, storedName),
    mimeType: params.mimeType,
    fileSizeBytes: params.buffer.byteLength,
  };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  const fullPath = path.join(localRoot(), filePath);
  return readFile(fullPath);
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  const fullPath = path.join(localRoot(), filePath);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing files
  }
}
