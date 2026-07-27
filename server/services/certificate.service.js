const PDFDocument = require('pdfkit');

// Streams a simple, self-contained donation certificate directly to `res` —
// no temp files, no external rendering service.
function streamDonationCertificate(res, { donorName, bloodGroup, donationDate, unitsDonated, hospitalName, certificateId }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bloodnet-certificate-${certificateId}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 72 });
  doc.pipe(res);

  doc
    .fillColor('#b91c1c')
    .fontSize(28)
    .font('Helvetica-Bold')
    .text('BloodNet', { align: 'center' });

  doc
    .moveDown(0.3)
    .fillColor('#111827')
    .fontSize(16)
    .font('Helvetica')
    .text('Certificate of Blood Donation', { align: 'center' });

  doc.moveDown(2);
  doc
    .fontSize(12)
    .text('This certifies that', { align: 'center' })
    .moveDown(0.5)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(donorName, { align: 'center' })
    .font('Helvetica')
    .fontSize(12)
    .moveDown(0.5)
    .text(
      `donated ${unitsDonated} unit${unitsDonated === 1 ? '' : 's'} of ${bloodGroup} blood` +
        (hospitalName ? ` through ${hospitalName}` : '') +
        ` on ${new Date(donationDate).toLocaleDateString()}.`,
      { align: 'center' }
    );

  doc.moveDown(2);
  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .text('Thank you for helping save a life. Every donation matters.', { align: 'center' })
    .moveDown(1)
    .text(`Certificate ID: ${certificateId}`, { align: 'center' })
    .text(`Issued: ${new Date().toLocaleDateString()}`, { align: 'center' });

  doc.end();
}

module.exports = { streamDonationCertificate };
