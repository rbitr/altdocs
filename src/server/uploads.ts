import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const UPLOAD_DIR = path.resolve(__dirname, '../../data/uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Parse a multipart/form-data request manually.
 * Extracts the first file part from the request body.
 * Returns { filename, contentType, data } or null.
 */
function parseMultipart(
  body: Buffer,
  contentType: string
): { filename: string; contentType: string; data: Buffer } | null {
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1].trim();
  const delimiter = Buffer.from(`--${boundary}`);

  // Find the first part
  const startIdx = body.indexOf(delimiter);
  if (startIdx === -1) return null;

  const afterDelimiter = startIdx + delimiter.length;
  // Find the end of this part (next delimiter)
  const endIdx = body.indexOf(delimiter, afterDelimiter);
  if (endIdx === -1) return null;

  const part = body.subarray(afterDelimiter, endIdx);

  // Find the double CRLF that separates headers from body
  const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
  if (headerEnd === -1) return null;

  const headers = part.subarray(0, headerEnd).toString('utf-8');
  // Data starts after \r\n\r\n and ends before trailing \r\n
  let data = part.subarray(headerEnd + 4);
  if (data.length >= 2 && data[data.length - 1] === 0x0a && data[data.length - 2] === 0x0d) {
    data = data.subarray(0, data.length - 2);
  }

  // Parse Content-Disposition header for filename
  const dispositionMatch = headers.match(/Content-Disposition:.*filename="([^"]+)"/i);
  const filename = dispositionMatch ? dispositionMatch[1] : 'unknown';

  // Parse Content-Type header
  const typeMatch = headers.match(/Content-Type:\s*(.+)/i);
  const partContentType = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';

  return { filename, contentType: partContentType, data };
}

// POST /api/uploads — upload an image file
router.post('/api/uploads', (req: Request, res: Response) => {
  const rawContentType = req.headers['content-type'] || '';

  if (!rawContentType.startsWith('multipart/form-data')) {
    res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE + 1024) {
      // Extra 1KB for multipart headers
      res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (res.writableEnded) return; // Already sent error response

    const body = Buffer.concat(chunks);
    const parsed = parseMultipart(body, rawContentType);

    if (!parsed) {
      res.status(400).json({ error: 'Could not parse file from request' });
      return;
    }

    if (parsed.data.length > MAX_FILE_SIZE) {
      res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
      return;
    }

    const ext = ALLOWED_MIME_TYPES[parsed.contentType];
    if (!ext) {
      res.status(400).json({
        error: `Unsupported file type: ${parsed.contentType}. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
      });
      return;
    }

    ensureUploadDir();

    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filepath, parsed.data);

    res.status(201).json({ url: `/uploads/${filename}` });
  });

  req.on('error', () => {
    if (!res.writableEnded) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

export { router as uploadRouter, UPLOAD_DIR, parseMultipart };
