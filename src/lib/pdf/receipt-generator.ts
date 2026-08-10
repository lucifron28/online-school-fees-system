import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import { fitPdfText } from '@/lib/pdf/text';
import { formatCentavosForPdf } from '@/lib/utils/currency';

export interface ReceiptPdfData {
  receiptNumber: string;
  verificationIdentifier: string;
  status?: 'ACTIVE' | 'VOIDED';
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  studentNumber: string;
  studentName: string;
  gradeAndSection: string;
  amountReceivedCentavos: number;
  balanceAfterPaymentCentavos: number | null;
  processedByName: string;
  allocations: Array<{
    name: string;
    amountCentavos: number;
  }>;
  institution: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
}

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 750;
const ROW_HEIGHT = 16;
const SUMMARY_MIN_Y = 235;

type PdfFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

function drawAllocationHeader(page: PDFPage, y: number, bold: PdfFont) {
  const { width } = page.getSize();
  page.drawRectangle({
    x: 40,
    y: y - 4,
    width: width - 80,
    height: 20,
    color: rgb(0.9, 0.93, 0.97),
  });
  page.drawText('Fee Description', {
    x: 50,
    y,
    size: 9,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('Amount Allocated', {
    x: width - 150,
    y,
    size: 9,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  return y - 20;
}

function drawAllocation(
  page: PDFPage,
  allocation: ReceiptPdfData['allocations'][number],
  y: number,
  regular: PdfFont,
  bold: PdfFont
) {
  page.drawText(fitPdfText(allocation.name, regular, 9, 380), {
    x: 50,
    y,
    size: 9,
    font: regular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(formatCentavosForPdf(allocation.amountCentavos), {
    x: PAGE_WIDTH - 150,
    y,
    size: 9,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function rowsThatFit(startY: number, minimumNextY: number) {
  return Math.max(0, Math.floor((startY - minimumNextY) / ROW_HEIGHT));
}

function drawFooter(page: PDFPage, pageNumber: number, totalPages: number, regular: PdfFont) {
  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - 105,
    y: 32,
    size: 7,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
}

function drawFirstPageHeader(page: PDFPage, data: ReceiptPdfData, bold: PdfFont, regular: PdfFont) {
  const { width, height } = page.getSize();
  let y = height - 50;

  page.drawText(fitPdfText(data.institution.name.toUpperCase(), bold, 14, width - 80), {
    x: 40,
    y,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.15, 0.3),
  });
  y -= 16;
  page.drawText(fitPdfText(data.institution.address, regular, 9, width - 80), {
    x: 40,
    y,
    size: 9,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 12;
  page.drawText(
    fitPdfText(
      `Email: ${data.institution.email} | Phone: ${data.institution.phone}`,
      regular,
      9,
      width - 80
    ),
    {
      x: 40,
      y,
      size: 9,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    }
  );

  y -= 35;
  page.drawRectangle({
    x: 40,
    y: y - 5,
    width: width - 80,
    height: 28,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });
  page.drawText(
    data.status === 'VOIDED'
      ? 'PAYMENT ACKNOWLEDGMENT RECEIPT - VOIDED'
      : 'PAYMENT ACKNOWLEDGMENT RECEIPT',
    {
      x: 50,
      y: y + 3,
      size: 12,
      font: bold,
      color: rgb(0.05, 0.25, 0.6),
    }
  );
  page.drawText(fitPdfText(`Receipt No: ${data.receiptNumber}`, bold, 10, 155), {
    x: width - 210,
    y: y + 3,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 40;
  page.drawText('Receipt Information', {
    x: 40,
    y,
    size: 10,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 15;

  const infoRows = [
    ['Student Name:', data.studentName, 'Date & Time:', data.paymentDate],
    ['Student Number:', data.studentNumber, 'Payment Method:', data.paymentMethod],
    ['Grade & Section:', data.gradeAndSection, 'Reference No:', data.referenceNumber || 'N/A'],
  ];

  for (const row of infoRows) {
    page.drawText(row[0], { x: 40, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(fitPdfText(row[1], regular, 9, 170), {
      x: 140,
      y,
      size: 9,
      font: regular,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(row[2], { x: 320, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(fitPdfText(row[3], regular, 9, 125), {
      x: 430,
      y,
      size: 9,
      font: regular,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
  }

  y -= 25;
  page.drawText('Payment Allocation Breakdown', {
    x: 40,
    y,
    size: 10,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 15;
  return drawAllocationHeader(page, y, bold);
}

function drawContinuationPageHeader(page: PDFPage, data: ReceiptPdfData, bold: PdfFont) {
  const { width, height } = page.getSize();
  let y = height - 50;
  page.drawText(fitPdfText(data.institution.name.toUpperCase(), bold, 11, width - 80), {
    x: 40,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.15, 0.3),
  });
  y -= 20;
  page.drawText('Payment Allocation Breakdown (continued)', {
    x: 40,
    y,
    size: 10,
    font: bold,
    color: rgb(0.05, 0.25, 0.6),
  });
  y -= 24;
  return drawAllocationHeader(page, y, bold);
}

function drawSummary(
  page: PDFPage,
  data: ReceiptPdfData,
  startY: number,
  bold: PdfFont,
  regular: PdfFont
) {
  let y = startY - 20;
  const { width } = page.getSize();
  page.drawRectangle({
    x: 40,
    y: y - 35,
    width: width - 80,
    height: 45,
    color: rgb(0.96, 0.98, 0.96),
    borderColor: rgb(0.8, 0.9, 0.8),
    borderWidth: 1,
  });
  page.drawText('Total Amount Received:', {
    x: 55,
    y: y - 10,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.4, 0.1),
  });
  page.drawText(formatCentavosForPdf(data.amountReceivedCentavos), {
    x: 230,
    y: y - 10,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.5, 0.1),
  });
  page.drawText('Remaining Balance After Payment:', {
    x: 55,
    y: y - 28,
    size: 9,
    font: bold,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(
    data.balanceAfterPaymentCentavos === null
      ? 'Unavailable (legacy receipt)'
      : formatCentavosForPdf(data.balanceAfterPaymentCentavos),
    {
      x: 230,
      y: y - 28,
      size: 9,
      font: bold,
      color: rgb(0.7, 0.1, 0.1),
    }
  );

  y -= 80;
  page.drawText(fitPdfText(`Processed By: ${data.processedByName}`, regular, 9, 250), {
    x: 40,
    y,
    size: 9,
    font: regular,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(fitPdfText(`Verification ID: ${data.verificationIdentifier}`, regular, 9, 210), {
    x: width - 250,
    y,
    size: 9,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 45;
  page.drawRectangle({
    x: 40,
    y: y - 5,
    width: width - 80,
    height: 25,
    color: rgb(0.99, 0.95, 0.95),
    borderColor: rgb(0.95, 0.8, 0.8),
    borderWidth: 1,
  });
  page.drawText(
    'DEMO DISCLAIMER: Payment Acknowledgment Receipt - Fictional Capstone Demo System',
    {
      x: 50,
      y: y + 3,
      size: 8,
      font: bold,
      color: rgb(0.7, 0.1, 0.1),
    }
  );
}

/**
 * Generates a Payment Acknowledgment Receipt PDF using pdf-lib.
 * Returns Uint8Array binary bytes suitable for download or HTTP response.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawFirstPageHeader(page, data, bold, regular);
  let allocationIndex = 0;

  while (allocationIndex < data.allocations.length || allocationIndex === 0) {
    const remaining = data.allocations.length - allocationIndex;
    const summaryCapacity = rowsThatFit(y, SUMMARY_MIN_Y);
    const reserveSummary = remaining <= summaryCapacity;
    const rowsToDraw = reserveSummary ? remaining : summaryCapacity;

    for (let row = 0; row < rowsToDraw; row += 1) {
      drawAllocation(page, data.allocations[allocationIndex]!, y, regular, bold);
      allocationIndex += 1;
      y -= ROW_HEIGHT;
    }

    if (allocationIndex < data.allocations.length) {
      const continuationPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page = continuationPage;
      y = drawContinuationPageHeader(continuationPage, data, bold);
      continue;
    }

    if (y < SUMMARY_MIN_Y) {
      const summaryPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 80;
      drawSummary(summaryPage, data, y, bold, regular);
    } else {
      drawSummary(page, data, y, bold, regular);
    }
    break;
  }

  const pages = pdfDoc.getPages();
  pages.forEach((currentPage, index) => drawFooter(currentPage, index + 1, pages.length, regular));
  return pdfDoc.save();
}
