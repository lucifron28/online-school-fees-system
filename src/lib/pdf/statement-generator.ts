import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import { formatCentavosForPdf } from '@/lib/utils/currency';
import { formatReportDate, type StatementEntry, type StudentStatement } from '@/lib/reports';
import { fitPdfText } from '@/lib/pdf/text';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_BOTTOM = 112;
const ROW_HEIGHT = 16;
const DISCLAIMER =
  'DEMO DISCLAIMER: Fictional capstone statement; not an official tax or accounting document.';

function drawTableHeader(
  page: PDFPage,
  y: number,
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const { width } = page.getSize();
  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: width - 80,
    height: 18,
    color: rgb(0.9, 0.93, 0.97),
  });
  page.drawText('Date', { x: 48, y, size: 8, font: bold });
  page.drawText('Description', { x: 125, y, size: 8, font: bold });
  page.drawText('Debit', { x: 370, y, size: 8, font: bold });
  page.drawText('Credit', { x: 440, y, size: 8, font: bold });
  page.drawText('Balance', { x: 505, y, size: 8, font: bold });
  return y - 20;
}

function drawEntry(
  page: PDFPage,
  entry: StatementEntry,
  y: number,
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  page.drawText(formatReportDate(entry.createdAt), { x: 48, y, size: 7, font: regular });
  page.drawText(fitPdfText(entry.description, regular, 7, 235), {
    x: 125,
    y,
    size: 7,
    font: regular,
  });
  page.drawText(formatCentavosForPdf(entry.debitCentavos), { x: 370, y, size: 7, font: regular });
  page.drawText(formatCentavosForPdf(entry.creditCentavos), {
    x: 440,
    y,
    size: 7,
    font: regular,
  });
  page.drawText(formatCentavosForPdf(entry.balanceCentavos), {
    x: 505,
    y,
    size: 7,
    font: regular,
  });
}

function drawFooter(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  page.drawText(fitPdfText(DISCLAIMER, bold, 7, PAGE_WIDTH - 150), {
    x: 40,
    y: 40,
    size: 7,
    font: bold,
    color: rgb(0.7, 0.1, 0.1),
  });
  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - 105,
    y: 40,
    size: 7,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
}

function drawFirstPage(
  page: PDFPage,
  statement: StudentStatement,
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const { width, height } = page.getSize();
  let y = height - 48;

  page.drawText(fitPdfText(statement.institution.name.toUpperCase(), bold, 14, width - 80), {
    x: 40,
    y,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.15, 0.3),
  });
  y -= 16;
  page.drawText(fitPdfText(statement.institution.address, regular, 9, width - 80), {
    x: 40,
    y,
    size: 9,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 28;
  page.drawText('STUDENT STATEMENT OF ACCOUNT', {
    x: 40,
    y,
    size: 13,
    font: bold,
    color: rgb(0.05, 0.25, 0.6),
  });
  y -= 20;
  page.drawText(
    statement.dateRange
      ? `Period: ${statement.dateRange.from} to ${statement.dateRange.to}`
      : `Generated: ${formatReportDate(new Date())}`,
    { x: 40, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) }
  );

  y -= 30;
  page.drawText(fitPdfText(`Student: ${statement.student.name}`, bold, 10, 250), {
    x: 40,
    y,
    size: 10,
    font: bold,
  });
  page.drawText(fitPdfText(`Student No: ${statement.student.studentNumber}`, regular, 10, 240), {
    x: 320,
    y,
    size: 10,
    font: regular,
  });
  y -= 16;
  page.drawText(
    fitPdfText(
      `Grade & Section: ${
        [statement.student.gradeLevelName, statement.student.sectionName]
          .filter(Boolean)
          .join(' - ') || 'Not assigned'
      }`,
      regular,
      9,
      250
    ),
    { x: 40, y, size: 9, font: regular }
  );
  page.drawText(fitPdfText(`Email: ${statement.student.email}`, regular, 9, 240), {
    x: 320,
    y,
    size: 9,
    font: regular,
  });

  y -= 28;
  page.drawRectangle({
    x: 40,
    y: y - (statement.dateRange ? 45 : 30),
    width: width - 80,
    height: statement.dateRange ? 55 : 40,
    color: rgb(0.96, 0.98, 0.96),
    borderColor: rgb(0.8, 0.9, 0.8),
    borderWidth: 1,
  });
  if (statement.dateRange) {
    page.drawText('Opening Balance:', { x: 55, y: y - 12, size: 9, font: bold });
    page.drawText(formatCentavosForPdf(statement.openingBalanceCentavos ?? 0), {
      x: 170,
      y: y - 12,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.4, 0.1),
    });
    page.drawText('Closing Balance:', { x: 320, y: y - 12, size: 9, font: bold });
    page.drawText(formatCentavosForPdf(statement.closingBalanceCentavos), {
      x: 435,
      y: y - 12,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.4, 0.1),
    });
  } else {
    page.drawText('Closing Balance:', { x: 55, y: y - 10, size: 10, font: bold });
    page.drawText(formatCentavosForPdf(statement.closingBalanceCentavos), {
      x: 190,
      y: y - 10,
      size: 12,
      font: bold,
      color: rgb(0.1, 0.4, 0.1),
    });
  }

  y -= statement.dateRange ? 77 : 62;
  page.drawText('Ledger Activity', { x: 40, y, size: 10, font: bold });
  y -= 15;
  return drawTableHeader(page, y, bold);
}

function drawContinuationPage(
  page: PDFPage,
  statement: StudentStatement,
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const { width, height } = page.getSize();
  let y = height - 48;
  page.drawText(fitPdfText(statement.institution.name.toUpperCase(), bold, 11, width - 80), {
    x: 40,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.15, 0.3),
  });
  y -= 24;
  page.drawText('Ledger Activity (continued)', {
    x: 40,
    y,
    size: 10,
    font: bold,
    color: rgb(0.05, 0.25, 0.6),
  });
  y -= 22;
  return drawTableHeader(page, y, bold);
}

export async function generateStatementPdf(statement: StudentStatement): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const entries = statement.entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const byDate = left.entry.createdAt.getTime() - right.entry.createdAt.getTime();
      return byDate || left.index - right.index;
    })
    .map(({ entry }) => entry);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawFirstPage(page, statement, bold, regular);
  let entryIndex = 0;

  while (entryIndex < entries.length) {
    while (entryIndex < entries.length && y > CONTENT_BOTTOM) {
      drawEntry(page, entries[entryIndex]!, y, regular);
      entryIndex += 1;
      y -= ROW_HEIGHT;
    }

    if (entryIndex < entries.length) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawContinuationPage(page, statement, bold, regular);
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) =>
    drawFooter(currentPage, index + 1, pages.length, bold, regular)
  );
  return pdfDoc.save();
}
