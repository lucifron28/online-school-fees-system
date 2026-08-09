import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatCentavosForPdf } from '@/lib/utils/currency';
import { formatReportDate, type StudentStatement } from '@/lib/reports';

export async function generateStatementPdf(statement: StudentStatement): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  let y = height - 48;

  page.drawText(statement.institution.name.toUpperCase(), {
    x: 40,
    y,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.15, 0.3),
  });
  y -= 16;
  page.drawText(statement.institution.address, {
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
  page.drawText(`Student: ${statement.student.name}`, { x: 40, y, size: 10, font: bold });
  page.drawText(`Student No: ${statement.student.studentNumber}`, {
    x: 320,
    y,
    size: 10,
    font: regular,
  });
  y -= 16;
  page.drawText(
    `Grade & Section: ${
      [statement.student.gradeLevelName, statement.student.sectionName]
        .filter(Boolean)
        .join(' - ') || 'Not assigned'
    }`,
    { x: 40, y, size: 9, font: regular }
  );
  page.drawText(`Email: ${statement.student.email}`, { x: 320, y, size: 9, font: regular });

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
  y -= 20;

  for (const entry of statement.entries.slice(-24)) {
    if (y < 75) break;
    page.drawText(formatReportDate(entry.createdAt), { x: 48, y, size: 7, font: regular });
    page.drawText(entry.description.slice(0, 42), { x: 125, y, size: 7, font: regular });
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
    y -= 16;
  }

  page.drawText(
    'DEMO DISCLAIMER: Fictional capstone statement; not an official tax or accounting document.',
    {
      x: 40,
      y: 40,
      size: 8,
      font: bold,
      color: rgb(0.7, 0.1, 0.1),
    }
  );

  return pdfDoc.save();
}
