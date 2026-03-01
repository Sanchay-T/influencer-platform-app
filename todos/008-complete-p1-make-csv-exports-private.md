---
status: complete
priority: p1
issue_id: "008"
tags: [security, privacy, exports]
dependencies: []
---

# Make CSV Exports Private (P0 #8)

## Problem Statement

CSV exports are uploaded to Vercel Blob with `access: 'public'`, meaning anyone with the URL can access creator data.

## Findings

- File: `app/api/export/csv-worker/route.ts` (audit points to line ~175)
- Risk: data leakage via URL sharing / guessing / referrer logs.

## Proposed Solutions

### Option 1: Use private blobs + signed download URLs (recommended)

**Approach:** store blobs as private and generate time-limited signed URLs for downloads.

### Option 2: Encrypt-at-rest in blob and keep public

**Approach:** upload encrypted content and decrypt on download.

## Recommended Action

Option 2. `@vercel/blob` is public-only in this app, so exports must be encrypted before upload and decrypted behind an authenticated download endpoint.

## Acceptance Criteria

- [x] Export blob contains ciphertext (safe even though Blob URLs are public).
- [x] Client never receives the blob URL.
- [x] Users can download exports via authenticated download endpoint (`/api/export/download/[id]`).
- [x] Direct blob URL does not contain plaintext CSV.

## Work Log

### 2026-02-12 - Todo Created

**By:** Codex

**Actions:**
- Captured audit issue into this todo.

### 2026-02-12 - Encrypt CSV Exports + Authenticated Download API

**By:** Codex

**Actions:**
- Added AES-256-GCM encryption helper: `lib/export/csv-encryption.ts`
  - Envelope: `GEMZCSV1 + iv(12) + tag(16) + ciphertext`
  - Key: `CSV_EXPORT_ENCRYPTION_KEY` (32 bytes, hex or base64)
- Updated export worker to encrypt before Blob upload:
  - `app/api/export/csv-worker/route.ts`
  - Uploads `application/octet-stream` payload to Blob
- Added authenticated download endpoint:
  - `app/api/export/download/[id]/route.ts`
  - Fetches ciphertext from Blob, decrypts, returns `text/csv` with `Content-Disposition` attachment and `Cache-Control: no-store`
- Updated status endpoint to return internal download URL (never blob URL):
  - `app/api/export/status/[id]/route.ts`
- Added unit tests:
  - `lib/export/csv-encryption.test.ts`

**Verification:**
- Status endpoint screenshot: `tmp/verify-csv-export-status.png`
- Manual curl check showed `/api/export/status/<id>` returns `/api/export/download/<id>` (not Blob URL) and the Blob URL begins with the `GEMZCSV1` magic header.
