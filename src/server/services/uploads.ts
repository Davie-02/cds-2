import type { Db } from "../db/pool.js";
import { badRequest, notFound } from "../errors.js";
import type { CurrentUser } from "./auth.js";

interface FileKind {
  mime: string;
  extension: string;
  matches: (bytes: Buffer) => boolean;
}

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Accepted file types, identified by their content rather than the name or browser-supplied
 * type. SVG and HTML are deliberately absent because they can carry scripts.
 */
const FILE_KINDS: FileKind[] = [
  { mime: "image/jpeg", extension: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  {
    mime: "image/png",
    extension: "png",
    matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mime: "image/gif",
    extension: "gif",
    matches: (b) => b.subarray(0, 6).toString("ascii").startsWith("GIF8"),
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    mime: "application/pdf",
    extension: "pdf",
    matches: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    mime: "video/mp4",
    extension: "mp4",
    matches: (b) => b.subarray(4, 8).toString("ascii") === "ftyp",
  },
  {
    mime: "video/webm",
    extension: "webm",
    matches: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  },
];

export function detectFileKind(bytes: Buffer): FileKind | null {
  return FILE_KINDS.find((kind) => kind.matches(bytes)) ?? null;
}

export function safeFilename(name: string, extension: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${extension}`;
}

export interface StoredUpload {
  id: string;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

export class UploadService {
  constructor(
    private readonly db: Db,
    private readonly maxBytes: number,
  ) {}

  /** Private files (student documents, payment proofs) are only served to signed-in users. */
  async store(
    bytes: Buffer,
    originalName: string,
    user: CurrentUser,
    isPrivate: boolean,
  ): Promise<StoredUpload> {
    if (!bytes.length) throw badRequest("The file is empty");
    if (bytes.length > this.maxBytes) {
      throw badRequest(`Files can be at most ${Math.round(this.maxBytes / 1_048_576)} MB`);
    }
    const kind = detectFileKind(bytes);
    if (!kind)
      throw badRequest("Only JPG, PNG, GIF, WebP, PDF, MP4 and WebM files can be uploaded");
    const filename = safeFilename(originalName, kind.extension);
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO uploads (filename, mime_type, size, data, is_private, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [filename, kind.mime, bytes.length, bytes, isPrivate, user.id],
    );
    const id = rows[0]!.id;
    return {
      id,
      url: `/uploads/${id}/${filename}`,
      filename,
      mime_type: kind.mime,
      size: bytes.length,
    };
  }

  async read(id: string, user: CurrentUser | null) {
    const { rows } = await this.db.query<{
      filename: string;
      mime_type: string;
      data: Buffer;
      is_private: boolean;
      uploaded_by: string | null;
    }>("SELECT filename, mime_type, data, is_private, uploaded_by FROM uploads WHERE id = $1", [
      id,
    ]);
    const file = rows[0];
    if (!file) throw notFound("File");
    if (file.is_private && !canReadPrivate(user, file.uploaded_by)) throw notFound("File");
    return file;
  }
}

function canReadPrivate(user: CurrentUser | null, uploadedBy: string | null): boolean {
  if (!user) return false;
  if (user.role === "student") return user.id === uploadedBy;
  return user.permissions.size > 0;
}
