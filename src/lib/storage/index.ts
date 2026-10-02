/**
 * Storage abstraction — local filesystem (dev) or S3-compatible private object storage (prod).
 * Business logic only ever sees opaque storage keys — never public URLs.
 */

import { randomUUID, createHash } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import {
  ALLOWED_UPLOAD_MIME,
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/types";
import { getMaxUploadBytes } from "@/lib/env";
import { log } from "@/lib/logging";

export type StoredFile = {
  fileName: string;
  filePath: string; // opaque storage key
  mimeType: string;
  fileSizeBytes: number;
  storageProvider: string;
};

function maxBytes(): number {
  return Math.min(getMaxUploadBytes(), MAX_UPLOAD_BYTES);
}

export function validateUpload(mimeType: string, sizeBytes: number, originalName?: string): void {
  if (!ALLOWED_UPLOAD_MIME.has(mimeType)) {
    throw new Error("Unsupported file type. Allowed: PDF, JPG, JPEG, PNG.");
  }
  if (sizeBytes <= 0 || sizeBytes > maxBytes()) {
    throw new Error(`File size must be between 1 byte and ${maxBytes() / (1024 * 1024)} MB`);
  }
  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext && !ALLOWED_UPLOAD_EXTENSIONS.includes(ext as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
      throw new Error("Unsupported file extension. Allowed: .pdf, .jpg, .jpeg, .png");
    }
    // Block double-extension tricks like invoice.pdf.exe
    const lower = originalName.toLowerCase();
    if (/\.(exe|sh|bat|cmd|js|mjs|cjs|php|asp|aspx|html|htm|svg)(\.|$)/i.test(lower)) {
      throw new Error("Executable or script uploads are not allowed");
    }
  }
}

export function getStorageProvider(): string {
  return (process.env.STORAGE_PROVIDER || "local").toLowerCase();
}

function localRoot(): string {
  return process.env.STORAGE_LOCAL_PATH || "./storage";
}

function assertSafeKey(filePath: string) {
  if (!filePath || filePath.includes("..") || path.isAbsolute(filePath) || filePath.startsWith("~")) {
    throw new Error("Invalid storage key");
  }
}

function extensionFor(mimeType: string, originalName: string): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (ALLOWED_UPLOAD_EXTENSIONS.includes(fromName as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    return fromName;
  }
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return "";
}

async function storeLocal(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  const ext = extensionFor(params.mimeType, params.originalName);
  const hash = createHash("sha256").update(params.buffer).digest("hex").slice(0, 12);
  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${hash}${ext}`;
  const folderPath = path.join(localRoot(), params.folder);
  await mkdir(folderPath, { recursive: true });
  const fullPath = path.join(folderPath, storedName);
  // Ensure resolved path stays under root
  if (!path.resolve(fullPath).startsWith(path.resolve(localRoot()))) {
    throw new Error("Invalid storage path");
  }
  await writeFile(fullPath, params.buffer);
  return {
    fileName: path.basename(params.originalName).slice(0, 180),
    filePath: path.join(params.folder, storedName).replaceAll("\\", "/"),
    mimeType: params.mimeType,
    fileSizeBytes: params.buffer.byteLength,
    storageProvider: "local",
  };
}

async function storeS3(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || "auto";
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;
  if (!bucket || !accessKey || !secretKey) {
    throw new Error("S3 storage is not fully configured");
  }

  const ext = extensionFor(params.mimeType, params.originalName);
  const key = `${params.folder}/${Date.now()}-${randomUUID()}${ext}`.replaceAll("//", "/");

  // Prefer AWS SDK if present; otherwise use signed PUT via fetch + AWS SigV4-lite is complex.
  // Use dynamic import of @aws-sdk/client-s3 when available; otherwise fail with clear message.
  try {
    // Optional dependency — install @aws-sdk/client-s3 for production object storage.
    const modName = "@aws-sdk/client-s3";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aws = require(modName) as {
      S3Client: new (cfg: Record<string, unknown>) => { send: (cmd: unknown) => Promise<unknown> };
      PutObjectCommand: new (input: Record<string, unknown>) => unknown;
    };
    const client = new aws.S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    await client.send(
      new aws.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Cannot find module") || msg.includes("MODULE_NOT_FOUND")) {
      throw new Error(
        "S3 storage selected but @aws-sdk/client-s3 is not installed. Install it for production object storage."
      );
    }
    log.error("storage.s3_put_failed", { message: msg });
    throw new Error("Document storage failed");
  }

  return {
    fileName: path.basename(params.originalName).slice(0, 180),
    filePath: key,
    mimeType: params.mimeType,
    fileSizeBytes: params.buffer.byteLength,
    storageProvider: "s3",
  };
}

export async function storeFile(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}): Promise<StoredFile> {
  validateUpload(params.mimeType, params.buffer.byteLength, params.originalName);
  const folder = params.folder.replace(/\.\./g, "").replace(/^\/+/, "");
  const provider = getStorageProvider();
  if (provider === "local") {
    return storeLocal({ ...params, folder });
  }
  if (provider === "s3" || provider === "r2" || provider === "minio") {
    return storeS3({ ...params, folder });
  }
  throw new Error(`Unsupported storage provider: ${provider}`);
}

async function readLocal(filePath: string): Promise<Buffer> {
  assertSafeKey(filePath);
  const fullPath = path.join(localRoot(), filePath);
  if (!path.resolve(fullPath).startsWith(path.resolve(localRoot()))) {
    throw new Error("Invalid storage key");
  }
  return readFile(fullPath);
}

async function readS3(filePath: string): Promise<Buffer> {
  assertSafeKey(filePath);
  const bucket = process.env.STORAGE_BUCKET!;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || "auto";
  const accessKey = process.env.STORAGE_ACCESS_KEY!;
  const secretKey = process.env.STORAGE_SECRET_KEY!;
  try {
    const modName = "@aws-sdk/client-s3";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aws = require(modName) as {
      S3Client: new (cfg: Record<string, unknown>) => {
        send: (cmd: unknown) => Promise<{ Body?: { transformToByteArray: () => Promise<Uint8Array> } }>;
      };
      GetObjectCommand: new (input: Record<string, unknown>) => unknown;
    };
    const client = new aws.S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const out = await client.send(new aws.GetObjectCommand({ Bucket: bucket, Key: filePath }));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object");
    return Buffer.from(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Cannot find module") || msg.includes("MODULE_NOT_FOUND")) {
      throw new Error(
        "S3 storage selected but @aws-sdk/client-s3 is not installed. Install it for production object storage."
      );
    }
    log.error("storage.s3_get_failed", { message: msg });
    throw new Error("Document retrieval failed");
  }
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  const provider = getStorageProvider();
  if (provider === "local") return readLocal(filePath);
  if (provider === "s3" || provider === "r2" || provider === "minio") return readS3(filePath);
  throw new Error(`Unsupported storage provider: ${provider}`);
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  try {
    assertSafeKey(filePath);
  } catch {
    return;
  }
  const provider = getStorageProvider();
  if (provider === "local") {
    try {
      await unlink(path.join(localRoot(), filePath));
    } catch {
      // ignore
    }
    return;
  }
  // Soft-delete metadata is preferred; hard delete from object storage is optional
}

/** Opaque authenticated download path — never a direct public storage URL. */
export function getSecureDocumentUrl(params: {
  ownerType: string;
  documentId: string;
}): string {
  return `/api/documents/${params.ownerType}/${params.documentId}`;
}

/**
 * Optional short-lived signed URL for direct browser download from private object storage.
 * Prefer authenticated app proxy (`getSecureDocumentUrl`) unless bandwidth requires signed URLs.
 */
export async function getSignedDocumentUrl(filePath: string, expiresSec = 120): Promise<string | null> {
  assertSafeKey(filePath);
  const provider = getStorageProvider();
  if (provider === "local") return null;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;
  if (!bucket || !accessKey || !secretKey) return null;
  try {
    const modName = "@aws-sdk/client-s3";
    const signerName = "@aws-sdk/s3-request-presigner";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aws = require(modName) as {
      S3Client: new (cfg: Record<string, unknown>) => unknown;
      GetObjectCommand: new (input: Record<string, unknown>) => unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const presigner = require(signerName) as {
      getSignedUrl: (
        client: unknown,
        command: unknown,
        input: { expiresIn: number }
      ) => Promise<string>;
    };
    const client = new aws.S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: !!process.env.STORAGE_ENDPOINT,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    return await presigner.getSignedUrl(
      client,
      new aws.GetObjectCommand({ Bucket: bucket, Key: filePath }),
      { expiresIn: expiresSec }
    );
  } catch {
    return null;
  }
}
