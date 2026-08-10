import type { PDFFont } from 'pdf-lib';

/**
 * Normalizes and width-limits text before it is drawn with a standard PDF font.
 * Standard fonts do not provide wrapping, so a bounded single line is safer
 * than allowing long identifiers or descriptions to overlap adjacent columns.
 */
export function fitPdfText(value: string, font: PDFFont, size: number, maxWidth: number): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

  if (!normalized || maxWidth <= 0) return '';
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;

  const suffix = '...';
  const availableWidth = Math.max(0, maxWidth - font.widthOfTextAtSize(suffix, size));
  const characters = Array.from(normalized);
  let low = 0;
  let high = characters.length;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join('').trimEnd()}${suffix}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) low = middle;
    else high = middle - 1;
  }

  return `${characters.slice(0, low).join('').trimEnd()}${suffix}`;
}
