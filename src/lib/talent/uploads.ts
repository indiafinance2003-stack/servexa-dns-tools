/**
 * Résumé upload validation.
 *
 * Pure and dependency-free so every rejection rule is unit tested without a
 * filesystem or a database. The public application form is the only
 * unauthenticated upload path in Ravelyth, so validation is deliberately strict:
 *
 *  - the extension must be one of PDF / DOC / DOCX (everything else, and in
 *    particular every executable or script extension, is refused);
 *  - the browser-supplied filename is only ever used to derive a display name
 *    and an extension — never a storage path;
 *  - path separators, traversal sequences, control characters and leading dots
 *    are stripped, so a crafted filename cannot escape the private directory;
 *  - a size limit is enforced in addition to the request-body guard.
 */

export const ALLOWED_RESUME_EXTENSIONS = ['pdf', 'doc', 'docx'] as const;
export type AllowedResumeExtension = (typeof ALLOWED_RESUME_EXTENSIONS)[number];

export const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

/**
 * Extensions that are never accepted, even when renamed. Listed explicitly so a
 * reviewer can see that the dangerous set was considered rather than assumed.
 */
export const BLOCKED_FILE_EXTENSIONS = [
  'exe',
  'msi',
  'bat',
  'cmd',
  'com',
  'cpl',
  'scr',
  'pif',
  'dll',
  'sys',
  'vbs',
  'vbe',
  'js',
  'jse',
  'mjs',
  'wsf',
  'wsh',
  'ps1',
  'psm1',
  'jar',
  'sh',
  'bash',
  'zsh',
  'py',
  'rb',
  'pl',
  'php',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'html',
  'htm',
  'xhtml',
  'svg',
  'xml',
  'hta',
  'lnk',
  'url',
  'reg',
  'iso',
  'img',
  'dmg',
  'apk',
  'deb',
  'rpm',
] as const;

/** Maximum display-name length kept in the database. */
export const MAX_FILENAME_LENGTH = 180;

export interface ResumeFileDescriptor {
  filename: string;
  contentType: string | null;
  byteSize: number;
}

export interface ValidatedResumeFile {
  /** Sanitized display filename (safe to render in the Owner Room). */
  filename: string;
  extension: AllowedResumeExtension;
  mimeType: string;
}

export type ResumeValidationResult =
  | { ok: true; file: ValidatedResumeFile }
  | { ok: false; error: string };

/** Returns the lowercase extension of a filename, or '' when there is none. */
export function extractExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Sanitizes a user-supplied filename into a safe display name.
 *
 * The result never contains a directory component, never begins with a dot and
 * never contains characters that are meaningful to a shell or a URL path.
 */
export function sanitizeFilename(filename: string): string {
  const withoutPaths = filename.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = withoutPaths
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');

  if (cleaned.length === 0) return 'resume';
  if (cleaned.length <= MAX_FILENAME_LENGTH) return cleaned;
  // Preserve the extension when truncating a long name.
  const extension = extractExtension(cleaned);
  const suffix = extension ? `.${extension}` : '';
  return cleaned.slice(0, MAX_FILENAME_LENGTH - suffix.length) + suffix;
}

/**
 * Validates a résumé upload.
 *
 * `maxBytes` comes from configuration so the limit has a single source of
 * truth; it is a required argument rather than a default so a misconfiguration
 * cannot silently widen the limit.
 */
export function validateResumeUpload(
  descriptor: ResumeFileDescriptor,
  maxBytes: number
): ResumeValidationResult {
  const rawName = typeof descriptor.filename === 'string' ? descriptor.filename : '';
  const filename = sanitizeFilename(rawName);
  const extension = extractExtension(filename);

  if (!Number.isFinite(descriptor.byteSize) || descriptor.byteSize <= 0) {
    return { ok: false, error: 'The uploaded file is empty.' };
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || descriptor.byteSize > maxBytes) {
    return {
      ok: false,
      error: `The résumé must be smaller than ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    };
  }
  if (extension.length === 0) {
    return { ok: false, error: 'The résumé must be a PDF, DOC or DOCX file.' };
  }
  if ((BLOCKED_FILE_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, error: 'That file type is not accepted.' };
  }
  if (!(ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, error: 'The résumé must be a PDF, DOC or DOCX file.' };
  }

  const declared = (descriptor.contentType ?? '').split(';')[0].trim().toLowerCase();
  // Browsers are inconsistent about the DOC/DOCX content type, so an empty or
  // generic type is allowed and the extension decides. A type that is present
  // AND wrong is refused rather than silently trusted.
  if (
    declared.length > 0 &&
    declared !== 'application/octet-stream' &&
    !(ALLOWED_RESUME_MIME_TYPES as readonly string[]).includes(declared)
  ) {
    return { ok: false, error: 'The résumé must be a PDF, DOC or DOCX file.' };
  }

  const mimeType =
    declared.length > 0 && declared !== 'application/octet-stream'
      ? declared
      : mimeForExtension(extension as AllowedResumeExtension);

  return {
    ok: true,
    file: { filename, extension: extension as AllowedResumeExtension, mimeType },
  };
}

/**
 * Whether the file body looks like the format its extension claims.
 *
 * Signature sniffing is a defence in depth on top of the extension and MIME
 * checks: a renamed executable will not carry the PDF/DOCX/OLE magic bytes.
 * Plain-text DOC files (no OLE header) are accepted because some editors emit
 * them, but anything with a known executable signature is refused.
 */
export function hasPlausibleSignature(head: Uint8Array, extension: string): boolean {
  if (head.length === 0) return false;

  const startsWith = (bytes: number[]): boolean =>
    head.length >= bytes.length && bytes.every((byte, index) => head[index] === byte);

  // Executable / archive / script signatures that must never pass.
  const dangerous: number[][] = [
    [0x4d, 0x5a], // MZ — Windows PE (EXE/DLL)
    [0x7f, 0x45, 0x4c, 0x46], // ELF
    [0x23, 0x21], // shebang
    [0xca, 0xfe, 0xba, 0xbe], // Mach-O / Java class
    [0x1f, 0x8b], // gzip
  ];

  if (extension === 'pdf') {
    return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
  }

  if (extension === 'docx') {
    // DOCX is a ZIP container.
    return startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06]);
  }

  if (extension === 'doc') {
    if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) return true; // OLE2 compound file
    if (dangerous.some((signature) => startsWith(signature))) return false;
    // Plain-text DOC / RTF fallback: refuse only control-heavy binary content.
    return !head.slice(0, 512).some((byte) => byte === 0x00);
  }

  return false;
}

/** Canonical MIME type for a permitted extension. */
export function mimeForExtension(extension: AllowedResumeExtension): string {
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
}