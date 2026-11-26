import PDFDocument from 'pdfkit';

export function generateFeeReceiptBuffer(payment, student, feeStructure, schoolSettings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text(schoolSettings?.schoolName || 'Greenfield International School', { align: 'center' });
    doc.fontSize(10).text(schoolSettings?.tagline || 'Excellence in Learning & Character', { align: 'center' });
    doc.fontSize(9).text(schoolSettings?.address || '123 Academic Way, Knowledge City', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).text('OFFICIAL FEE PAYMENT RECEIPT', { align: 'center', underline: true });
    doc.moveDown(1);

    // Metadata
    const startY = doc.y;
    doc.fontSize(10);
    doc.text(`Receipt No: ${payment.receiptNo}`, 40, startY);
    doc.text(`Date: ${new Date(payment.paidAt || Date.now()).toLocaleDateString()}`, 350, startY);

    doc.text(`Student: ${student.userId?.name || 'Student'}`, 40, startY + 18);
    doc.text(`Admission No: ${student.admissionNo}`, 350, startY + 18);

    doc.text(`Class: ${student.classId?.name || ''} - ${student.sectionId?.name || ''}`, 40, startY + 36);
    doc.text(`Payment Mode: ${payment.paymentMethod?.toUpperCase()}`, 350, startY + 36);

    doc.moveDown(3);

    // Line items table
    const tableTop = doc.y;
    doc.rect(40, tableTop, 515, 20).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
    doc.text('Fee Component / Description', 50, tableTop + 5);
    doc.text('Amount ($)', 450, tableTop + 5, { align: 'right' });

    let currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(10);

    const components = feeStructure?.components || [{ name: feeStructure?.name || 'Tuition Fee', amount: payment.amountPaid }];
    for (const comp of components) {
      doc.text(comp.name, 50, currentY);
      doc.text(comp.amount.toFixed(2), 450, currentY, { align: 'right' });
      currentY += 20;
    }

    doc.moveTo(40, currentY).lineTo(555, currentY).stroke('#cbd5e1');
    currentY += 10;

    // Total
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total Amount Paid:', 300, currentY);
    doc.text(`$${payment.amountPaid.toFixed(2)}`, 450, currentY, { align: 'right' });

    currentY += 30;
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text(`Status: ${payment.status?.toUpperCase()} | Generated automatically by School Management ERP.`, 40, currentY);

    doc.end();
  });
}

export function generateReportCardBuffer(student, exam, marksList, gradeSummary, schoolSettings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // School Header
    doc.fontSize(22).text(schoolSettings?.schoolName || 'Greenfield International School', { align: 'center' });
    doc.fontSize(10).text(schoolSettings?.tagline || 'Excellence in Learning & Character', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).text(`ACADEMIC REPORT CARD — ${exam.name?.toUpperCase()}`, { align: 'center', underline: true });
    doc.moveDown(1);

    // Student Info
    const topY = doc.y;
    doc.fontSize(10);
    doc.text(`Student Name: ${student.userId?.name}`, 40, topY);
    doc.text(`Roll No: ${student.rollNo || 'N/A'}`, 350, topY);

    doc.text(`Admission No: ${student.admissionNo}`, 40, topY + 18);
    doc.text(`Class & Section: ${student.classId?.name || ''} - ${student.sectionId?.name || ''}`, 350, topY + 18);

    doc.moveDown(3);

    // Marks Table
    const tableTop = doc.y;
    doc.rect(40, tableTop, 515, 20).fill('#e0e7ff');
    doc.fillColor('#1e1b4b').font('Helvetica-Bold').fontSize(10);
    doc.text('Subject', 50, tableTop + 5);
    doc.text('Max Marks', 220, tableTop + 5);
    doc.text('Obtained', 320, tableTop + 5);
    doc.text('Grade', 420, tableTop + 5);
    doc.text('Status', 480, tableTop + 5);

    let currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');

    for (const item of marksList) {
      doc.text(item.subjectName, 50, currentY);
      doc.text(String(item.maxMarks), 220, currentY);
      doc.text(String(item.marksObtained), 320, currentY);
      doc.text(item.grade || '—', 420, currentY);
      doc.text(item.isPass ? 'PASS' : 'FAIL', 480, currentY);
      currentY += 20;
    }

    doc.moveTo(40, currentY).lineTo(555, currentY).stroke('#cbd5e1');
    currentY += 15;

    // Summary Box
    doc.rect(40, currentY, 515, 55).stroke('#4f46e5');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e1b4b');
    doc.text(`Total Marks: ${gradeSummary.totalObtained} / ${gradeSummary.totalMax}`, 60, currentY + 12);
    doc.text(`Percentage: ${gradeSummary.percentage}%`, 220, currentY + 12);
    doc.text(`Overall Grade: ${gradeSummary.overallGrade}`, 380, currentY + 12);

    doc.text(`Cumulative GPA: ${gradeSummary.gpa}`, 60, currentY + 32);
    doc.text(`Remark: Satisfactory Academic Standing`, 220, currentY + 32);

    currentY += 80;
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Teacher Signature: _______________________', 60, currentY);
    doc.text('Principal Signature: _______________________', 340, currentY);

    doc.end();
  });
}

export function generatePlatformInvoiceBuffer(payment, school) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).text('STUDYX SAAS PLATFORM', { align: 'center' });
    doc.fontSize(10).text('Official Subscription Invoice & Payment Receipt', { align: 'center' });
    doc.moveDown(1.5);

    const startY = doc.y;
    doc.fontSize(10);
    doc.text(`Invoice No: ${payment.invoiceNo}`, 40, startY);
    doc.text(`Paid Date: ${new Date(payment.paidAt || Date.now()).toLocaleDateString()}`, 350, startY);
    doc.text(`School: ${school?.name || 'School'} (${school?.code || ''})`, 40, startY + 18);
    doc.text(`Method: ${String(payment.method || 'manual').toUpperCase()}`, 350, startY + 18);
    doc.text(`Reference: ${payment.reference || '—'}`, 40, startY + 36);
    doc.text(
      `Period: ${new Date(payment.periodStart).toLocaleDateString()} - ${new Date(payment.periodEnd).toLocaleDateString()}`,
      350,
      startY + 36
    );

    doc.moveDown(3.5);
    const tableTop = doc.y;
    doc.rect(40, tableTop, 515, 22).fill('#eef2ff');
    doc.fillColor('#1e1b4b').font('Helvetica-Bold').fontSize(10);
    doc.text('Subscription Plan', 50, tableTop + 6);
    doc.text('Amount ($)', 450, tableTop + 6, { align: 'right' });

    const rowY = tableTop + 30;
    doc.font('Helvetica').fillColor('#0f172a');
    doc.text(payment.planId?.name || 'School SaaS Subscription', 50, rowY);
    doc.text(`$${Number(payment.amount || 0).toFixed(2)}`, 450, rowY, { align: 'right' });

    doc.moveTo(40, rowY + 25).lineTo(555, rowY + 25).stroke('#cbd5e1');
    doc.font('Helvetica-Bold').text(`Total Paid: $${Number(payment.amount || 0).toFixed(2)}`, 40, rowY + 36, { align: 'right' });

    if (payment.note) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Note: ${payment.note}`, 40, rowY + 65);
    }

    doc.end();
  });
}
