import { describe, it, expect } from 'vitest';
import { detectPdfUrl, CHROME_PDF_VIEWER_ORIGIN } from '../../pdf/PdfDetector';

describe('detectPdfUrl', () => {
  it('detects Chrome built-in PDF viewer with http URL', () => {
    const url = `${CHROME_PDF_VIEWER_ORIGIN}index.html?file=${encodeURIComponent('https://example.com/paper.pdf')}`;
    const result = detectPdfUrl(url);
    expect(result.pdfUrl).toBe('https://example.com/paper.pdf');
    expect(result.via).toBe('chrome-viewer');
  });

  it('detects Chrome built-in PDF viewer with file URL', () => {
    const url = `${CHROME_PDF_VIEWER_ORIGIN}index.html?file=${encodeURIComponent('file:///home/user/doc.pdf')}`;
    const result = detectPdfUrl(url);
    expect(result.pdfUrl).toBe('file:///home/user/doc.pdf');
    expect(result.via).toBe('chrome-viewer');
  });

  it('detects Chrome built-in PDF viewer with blob URL', () => {
    const url = `${CHROME_PDF_VIEWER_ORIGIN}index.html?file=${encodeURIComponent('blob:https://app.example/1234-5678')}`;
    const result = detectPdfUrl(url);
    expect(result.pdfUrl).toBe('blob:https://app.example/1234-5678');
    expect(result.via).toBe('chrome-viewer');
  });

  it('recovers a raw percent sequence instead of throwing', () => {
    const url = `${CHROME_PDF_VIEWER_ORIGIN}index.html?file=https%3A%2F%2Fx.example%2Fa%25b.pdf`;
    const result = detectPdfUrl(url);
    expect(result.pdfUrl).toBe('https://x.example/a%b.pdf');
  });

  it('detects uppercase .PDF suffix', () => {
    const result = detectPdfUrl('https://example.com/REPORT.PDF');
    expect(result.pdfUrl).toBe('https://example.com/REPORT.PDF');
    expect(result.via).toBe('pdf-suffix');
  });

  it('detects .pdf with query string and fragment', () => {
    expect(detectPdfUrl('https://example.com/a.pdf?download=1').pdfUrl).toBe('https://example.com/a.pdf?download=1');
    expect(detectPdfUrl('https://example.com/a.pdf#page=2').pdfUrl).toBe('https://example.com/a.pdf#page=2');
  });

  it('detects local file PDFs', () => {
    const result = detectPdfUrl('file:///home/user/invoice.pdf');
    expect(result.pdfUrl).toBe('file:///home/user/invoice.pdf');
    expect(result.via).toBe('pdf-suffix');
  });

  it('does not match a path that merely contains .pdf as a directory name', () => {
    const result = detectPdfUrl('https://example.com/pdf/files/index.html');
    expect(result.pdfUrl).toBeNull();
  });

  it('does not match ordinary web pages', () => {
    const result = detectPdfUrl('https://example.com/index.html');
    expect(result.pdfUrl).toBeNull();
  });

  it('uses mime-type signal for Firefox (URL without .pdf suffix)', () => {
    const result = detectPdfUrl('https://example.com/download?id=42', 'application/pdf');
    expect(result.pdfUrl).toBe('https://example.com/download?id=42');
    expect(result.via).toBe('mime-type');
  });

  it('ignores mime-type for non-PDF types', () => {
    const result = detectPdfUrl('https://example.com/download?id=42', 'text/html');
    expect(result.pdfUrl).toBeNull();
  });

  it('handles missing tab URL', () => {
    expect(detectPdfUrl(undefined).pdfUrl).toBeNull();
  });

  it('handles Firefox resource://pdf.js viewer URL without a pdf suffix', () => {
    const result = detectPdfUrl('resource://pdf.js/web/viewer.html', 'application/pdf');
    expect(result.pdfUrl).toBe('resource://pdf.js/web/viewer.html');
    expect(result.via).toBe('mime-type');
  });
});
