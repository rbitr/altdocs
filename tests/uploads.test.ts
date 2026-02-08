import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMultipart, uploadRouter, UPLOAD_DIR } from '../src/server/uploads.js';
import type { Server } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── parseMultipart() unit tests ────────────────────────────────

describe('parseMultipart', () => {
  function buildMultipartBody(
    boundary: string,
    filename: string,
    contentType: string,
    data: Buffer
  ): Buffer {
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(
      Buffer.from(
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          `Content-Type: ${contentType}\r\n` +
          `\r\n`
      )
    );
    parts.push(data);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    return Buffer.concat(parts);
  }

  it('parses a valid multipart body with file', () => {
    const boundary = '----TestBoundary123';
    const fileData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const body = buildMultipartBody(boundary, 'test.png', 'image/png', fileData);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(result!.filename).toBe('test.png');
    expect(result!.contentType).toBe('image/png');
    expect(Buffer.compare(result!.data, fileData)).toBe(0);
  });

  it('returns null when no boundary in Content-Type', () => {
    const body = Buffer.from('some data');
    const result = parseMultipart(body, 'multipart/form-data');
    expect(result).toBeNull();
  });

  it('returns null when boundary delimiter not found in body', () => {
    const body = Buffer.from('no boundary here');
    const result = parseMultipart(body, 'multipart/form-data; boundary=----Missing');
    expect(result).toBeNull();
  });

  it('returns null when there is no second delimiter (no end boundary)', () => {
    const boundary = '----TestBoundary';
    const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\ndata`);
    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).toBeNull();
  });

  it('returns null when headers have no CRLF separator from body', () => {
    const boundary = '----TestBoundary';
    // Part with no \r\n\r\n separator
    const body = Buffer.from(`--${boundary}\r\nno-separator-here\r\n--${boundary}--\r\n`);
    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).toBeNull();
  });

  it('extracts filename from Content-Disposition header', () => {
    const boundary = '----B1';
    const body = buildMultipartBody(boundary, 'photo.jpg', 'image/jpeg', Buffer.from('img'));
    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result!.filename).toBe('photo.jpg');
  });

  it('returns "unknown" when filename is missing from headers', () => {
    const boundary = '----B2';
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"\r\nContent-Type: image/png\r\n\r\n`));
    parts.push(Buffer.from('data'));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(result!.filename).toBe('unknown');
  });

  it('returns "application/octet-stream" when Content-Type header is missing', () => {
    const boundary = '----B3';
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="blob"\r\n\r\n`));
    parts.push(Buffer.from('data'));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe('application/octet-stream');
  });

  it('strips trailing CRLF from file data', () => {
    const boundary = '----B4';
    const fileData = Buffer.from('hello');
    const body = buildMultipartBody(boundary, 'test.txt', 'text/plain', fileData);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    // The builder adds \r\n before the closing boundary, parseMultipart should strip it
    expect(result!.data.toString()).toBe('hello');
  });

  it('handles empty file data', () => {
    const boundary = '----B5';
    const fileData = Buffer.alloc(0);
    const body = buildMultipartBody(boundary, 'empty.png', 'image/png', fileData);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    // Empty data + trailing CRLF means data is just \r\n which gets stripped to empty
    expect(result!.data.length).toBeLessThanOrEqual(2); // At most the CRLF
  });

  it('handles binary file data (PNG-like)', () => {
    const boundary = '----B6';
    // Simulate a small binary "image"
    const fileData = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) fileData[i] = i;
    const body = buildMultipartBody(boundary, 'binary.png', 'image/png', fileData);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(Buffer.compare(result!.data, fileData)).toBe(0);
  });

  it('handles boundary with semicolons in content-type', () => {
    const boundary = '----WebKitBoundary';
    const fileData = Buffer.from('img');
    const body = buildMultipartBody(boundary, 'test.jpg', 'image/jpeg', fileData);

    // Content-type with extra params after boundary
    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}; charset=utf-8`);
    expect(result).not.toBeNull();
    expect(result!.filename).toBe('test.jpg');
  });

  it('handles large file data', () => {
    const boundary = '----B7';
    const fileData = Buffer.alloc(1024 * 100); // 100KB
    fileData.fill(0xab);
    const body = buildMultipartBody(boundary, 'large.jpg', 'image/jpeg', fileData);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(result!.data.length).toBe(fileData.length);
  });
});

// ── Upload Router integration tests ────────────────────────────

describe('Upload Router', () => {
  let server: Server;
  let baseUrl: string;
  let testUploadDir: string;

  function buildMultipartRequest(
    boundary: string,
    filename: string,
    contentType: string,
    data: Buffer
  ): Buffer {
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(
      Buffer.from(
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          `Content-Type: ${contentType}\r\n` +
          `\r\n`
      )
    );
    parts.push(data);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    return Buffer.concat(parts);
  }

  beforeAll(async () => {
    const app = express();
    app.use(uploadRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Clean up any uploaded test files
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
      }
    }
  });

  it('uploads a valid JPEG file', async () => {
    const boundary = '----TestBoundary';
    // JPEG magic bytes: FF D8 FF
    const fileData = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const body = buildMultipartRequest(boundary, 'test.jpg', 'image/jpeg', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);

    // Verify file was actually written
    const filename = json.url.replace('/uploads/', '');
    const filepath = path.join(UPLOAD_DIR, filename);
    expect(fs.existsSync(filepath)).toBe(true);
    const written = fs.readFileSync(filepath);
    expect(Buffer.compare(written, fileData)).toBe(0);
  });

  it('uploads a valid PNG file', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const body = buildMultipartRequest(boundary, 'test.png', 'image/png', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    expect(json.url).toMatch(/\.png$/);
  });

  it('uploads a valid GIF file', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('GIF89a');
    const body = buildMultipartRequest(boundary, 'test.gif', 'image/gif', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    expect(json.url).toMatch(/\.gif$/);
  });

  it('uploads a valid WebP file', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('RIFF\x00\x00\x00\x00WEBP');
    const body = buildMultipartRequest(boundary, 'test.webp', 'image/webp', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    expect(json.url).toMatch(/\.webp$/);
  });

  it('rejects non-multipart Content-Type', async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'data' }),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('multipart/form-data');
  });

  it('rejects unsupported MIME type (text/plain)', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('hello world');
    const body = buildMultipartRequest(boundary, 'test.txt', 'text/plain', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Unsupported file type');
    expect(json.error).toContain('text/plain');
  });

  it('rejects unsupported MIME type (application/pdf)', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('%PDF-1.4');
    const body = buildMultipartRequest(boundary, 'doc.pdf', 'application/pdf', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Unsupported file type');
  });

  it('rejects file larger than 5MB', async () => {
    const boundary = '----TestBoundary';
    // Create a file just over 5MB
    const fileData = Buffer.alloc(5 * 1024 * 1024 + 1);
    fileData.fill(0xab);
    const body = buildMultipartRequest(boundary, 'huge.jpg', 'image/jpeg', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(413);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('too large');
  });

  it('rejects malformed multipart body', async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=----Test' },
      body: Buffer.from('this is not valid multipart data'),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Could not parse');
  });

  it('returns unique filenames for each upload', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0xff, 0xd8, 0xff]);
    const body = buildMultipartRequest(boundary, 'same.jpg', 'image/jpeg', fileData);

    const res1 = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const res2 = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    const json1 = await res1.json() as { url: string };
    const json2 = await res2.json() as { url: string };
    expect(json1.url).not.toBe(json2.url);
  });

  it('ignores path traversal characters in user-supplied filename', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    // Attempt path traversal in filename
    const body = buildMultipartRequest(boundary, '../../../etc/passwd.jpg', 'image/jpeg', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    // Server generates a random hex filename, not using the user-supplied name
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);
    // No path traversal in the output
    expect(json.url).not.toContain('..');
  });

  it('rejects HTML content type (XSS vector)', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('<script>alert("xss")</script>');
    const body = buildMultipartRequest(boundary, 'evil.html', 'text/html', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Unsupported file type');
  });

  it('rejects SVG content type (XSS vector)', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('<svg onload="alert(1)"></svg>');
    const body = buildMultipartRequest(boundary, 'evil.svg', 'image/svg+xml', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Unsupported file type');
  });

  it('rejects application/javascript content type', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from('alert(1)');
    const body = buildMultipartRequest(boundary, 'evil.js', 'application/javascript', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(400);
  });

  it('rejects request with no Content-Type header', async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: Buffer.from('data'),
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('multipart/form-data');
  });

  it('accepts JPEG even if file extension in filename does not match', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    // Extension says .png but Content-Type says image/jpeg
    const body = buildMultipartRequest(boundary, 'image.png', 'image/jpeg', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    // Extension determined by Content-Type, not original filename
    expect(json.url).toMatch(/\.jpg$/);
  });

  it('handles filename with special characters', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const body = buildMultipartRequest(boundary, 'photo (1) [copy].png', 'image/png', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    // Server generates a safe random filename regardless
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.png$/);
  });

  it('handles filename with null bytes', async () => {
    const boundary = '----TestBoundary';
    const fileData = Buffer.from([0xff, 0xd8, 0xff]);
    const body = buildMultipartRequest(boundary, 'evil\x00.jpg', 'image/jpeg', fileData);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    // Should still succeed since filename is ignored for storage
    expect(res.status).toBe(201);
    const json = await res.json() as { url: string };
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);
  });
});
