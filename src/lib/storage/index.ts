import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/types";

export type StoredFile = {
  fileName: string;
  filePath: string; // storage key relative to provider root
  mimeType: string;
  fileSizeBytes: number;
  storageProvider: string;
};

export function validateUpload(mimeType: string, sizeBytes: number): void {
  if (!ALLOWED_UPLOAD_MIME.has(mimeType)) {
    throw new Error("Unsupported file type. Allowed: PDF, JPG, JPEG, PNG.");
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File size must be between 1 byte and ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`);
  }
}

function localRoot(): string {
  return process.env.STORAGE_LOCAL_PATH || "./storage";
}

export function getStorageProvider(): string {
  return process.env.STORAGE_PROVIDER || "local";
}

/**
 * Storage abstraction — local filesystem now, S3/R2-compatible later.
 * filePath returned is the opaque storage key (never a public URL).
 */
export async function storeFile(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  validateUpload(params.mimeType, params.buffer.byteLength);

  const provider = getStorageProvider();
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
    storageProvider: provider,
  };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  // Prevent path traversal — keys are relative storage paths only
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("Invalid storage key");
  }
  const fullPath = path.join(localRoot(), filePath);
  return readFile(fullPath);
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  if (filePath.includes("..") || path.isAbsolute(filePath)) return;
  const fullPath = path.join(localRoot(), filePath);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing files
  }
}

/** Opaque download path — never a direct public URL to storage. */
export function getSecureDocumentUrl(params: {
  ownerType: string;
  documentId: string;
}): string {
  return `/api/documents/${params.ownerType}/${params.documentId}`;
}
