import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatCentavosForPdf } from '@/lib/utils/currency';

export interface ReceiptPdfData {
  receiptNumber: string;
  verificationIdentifier: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  studentNumber: string;
  studentName: string;
  gradeAndSection: string;
  amountReceivedCentavos: number;
  remainingBalanceCentavos: number;
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

/**
 * Generates a Payment Acknowledgment Receipt PDF using pdf-lib.
 * Returns Uint8Array binary bytes suitable for download or HTTP response.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 750]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();
  let y = height - 50;

  // Header - Institution Name
  page.drawText(data.institution.name.toUpperCase(), {
    x: 40,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.3),
  });

  y -= 16;
  page.drawText(data.institution.address, {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 12;
  page.drawText(`Email: ${data.institution.email} | Phone: ${data.institution.phone}`, {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Title Banner
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

  page.drawText('PAYMENT ACKNOWLEDGMENT RECEIPT', {
    x: 50,
    y: y + 3,
    size: 12,
    font: fontBold,
    color: rgb(0.05, 0.25, 0.6),
  });

  page.drawText(`Receipt No: ${data.receiptNumber}`, {
    x: width - 210,
    y: y + 3,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Key Info Grid
  y -= 40;
  page.drawText('Receipt Information', {
    x: 40,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 15;

  const infoRows = [
    ['Student Name:', data.studentName, 'Date & Time:', data.paymentDate],
    ['Student Number:', data.studentNumber, 'Payment Method:', data.paymentMethod],
    ['Grade & Section:', data.gradeAndSection, 'Reference No:', data.referenceNumber || 'N/A'],
  ];

  for (const row of infoRows) {
    page.drawText(row[0], { x: 40, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(row[1], { x: 140, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    page.drawText(row[2], { x: 320, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(row[3], { x: 430, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

    y -= 16;
  }

  // Allocation Breakdown Table
  y -= 25;
  page.drawText('Payment Allocation Breakdown', {
    x: 40,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 15;

  // Table Header
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
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText('Amount Allocated', {
    x: width - 150,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 20;
  for (const item of data.allocations) {
    page.drawText(item.name, { x: 50, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatCentavosForPdf(item.amountCentavos), {
      x: width - 150,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
  }

  // Summary Totals Box
  y -= 20;
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
    font: fontBold,
    color: rgb(0.1, 0.4, 0.1),
  });
  page.drawText(formatCentavosForPdf(data.amountReceivedCentavos), {
    x: 230,
    y: y - 10,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.5, 0.1),
  });

  page.drawText('Remaining Balance:', {
    x: 55,
    y: y - 28,
    size: 9,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(formatCentavosForPdf(data.remainingBalanceCentavos), {
    x: 230,
    y: y - 28,
    size: 9,
    font: fontBold,
    color: rgb(0.7, 0.1, 0.1),
  });

  // Footer & Verification
  y -= 80;
  page.drawText(`Processed By: ${data.processedByName}`, {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText(`Verification ID: ${data.verificationIdentifier}`, {
    x: width - 250,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Capstone Demo Disclaimer
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
    'DEMO DISCLAIMER: Payment Acknowledgment Receipt — Fictional Capstone Demo System',
    {
      x: 50,
      y: y + 3,
      size: 8,
      font: fontBold,
      color: rgb(0.7, 0.1, 0.1),
    }
  );

  return pdfDoc.save();
}
