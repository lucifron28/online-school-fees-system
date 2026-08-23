import { describe, expect, it } from 'vitest';
import {
  assertPaymentProofRequestSize,
  MAX_PAYMENT_PROOF_BYTES,
  MAX_PAYMENT_PROOF_REQUEST_BYTES,
  validateProof,
} from '@/server/services/payment-submission.service';

const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const validWebpBuffer = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('VP8 ', 'ascii'),
]);

describe('Payment Proof Upload Size and Validation', () => {
  it('accepts a valid small PNG proof', () => {
    const validated = validateProof({
      mimeType: 'image/png',
      originalFileName: 'receipt.png',
      data: validPngBuffer,
    });
    expect(validated.mimeType).toBe('image/png');
    expect(validated.sizeBytes).toBe(validPngBuffer.length);
    expect(validated.sha256).toBeDefined();
  });

  it('accepts a valid JPEG and WebP proof', () => {
    const jpeg = validateProof({
      mimeType: 'image/jpeg',
      originalFileName: 'receipt.jpg',
      data: validJpegBuffer,
    });
    expect(jpeg.mimeType).toBe('image/jpeg');

    const webp = validateProof({
      mimeType: 'image/webp',
      originalFileName: 'receipt.webp',
      data: validWebpBuffer,
    });
    expect(webp.mimeType).toBe('image/webp');
  });

  it('rejects unsupported MIME types (e.g. application/pdf, image/gif)', () => {
    expect(() =>
      validateProof({
        mimeType: 'application/pdf',
        originalFileName: 'receipt.pdf',
        data: Buffer.from('%PDF-1.4...'),
      })
    ).toThrow(/Proof must be a JPEG, PNG, or WebP image/i);

    expect(() =>
      validateProof({
        mimeType: 'image/gif',
        originalFileName: 'receipt.gif',
        data: Buffer.from('GIF89a...'),
      })
    ).toThrow(/Proof must be a JPEG, PNG, or WebP image/i);
  });

  it('rejects MIME and magic bytes mismatch (e.g. JPEG declared with PNG bytes)', () => {
    expect(() =>
      validateProof({
        mimeType: 'image/jpeg',
        originalFileName: 'fake_jpeg.jpg',
        data: validPngBuffer,
      })
    ).toThrow(/proof content does not match its declared image type/i);

    expect(() =>
      validateProof({
        mimeType: 'image/png',
        originalFileName: 'fake_png.png',
        data: validJpegBuffer,
      })
    ).toThrow(/proof content does not match its declared image type/i);
  });

  it('rejects empty or corrupt non-image bytes', () => {
    expect(() =>
      validateProof({
        mimeType: 'image/png',
        originalFileName: 'empty.png',
        data: Buffer.alloc(0),
      })
    ).toThrow(/between 1 byte and 3 MiB/i);

    expect(() =>
      validateProof({
        mimeType: 'image/png',
        originalFileName: 'corrupt.png',
        data: Buffer.from('Hello world non image bytes'),
      })
    ).toThrow(/proof content does not match its declared image type/i);
  });

  it('rejects oversized file data exceeding 3 MiB', () => {
    const oversizedBuffer = Buffer.alloc(MAX_PAYMENT_PROOF_BYTES + 1);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    expect(() =>
      validateProof({
        mimeType: 'image/jpeg',
        originalFileName: 'huge.jpg',
        data: oversizedBuffer,
      })
    ).toThrow(/between 1 byte and 3 MiB/i);
  });

  describe('assertPaymentProofRequestSize', () => {
    it('allows requests within the Content-Length limit', () => {
      const request = new Request('http://localhost:3000/api/portal/parent/payment-submissions', {
        method: 'POST',
        headers: { 'content-length': String(1024 * 1024) },
      });
      expect(() => assertPaymentProofRequestSize(request)).not.toThrow();
    });

    it('rejects requests with Content-Length exceeding the maximum allowed request size', () => {
      const request = new Request('http://localhost:3000/api/portal/parent/payment-submissions', {
        method: 'POST',
        headers: { 'content-length': String(MAX_PAYMENT_PROOF_REQUEST_BYTES + 1) },
      });
      expect(() => assertPaymentProofRequestSize(request)).toThrow(
        /payment proof upload is too large/i
      );
    });

    it('rejects requests with negative or invalid Content-Length', () => {
      const request = new Request('http://localhost:3000/api/portal/parent/payment-submissions', {
        method: 'POST',
        headers: { 'content-length': '-5' },
      });
      expect(() => assertPaymentProofRequestSize(request)).toThrow(
        /payment proof upload is too large or invalid/i
      );
    });
  });
});
