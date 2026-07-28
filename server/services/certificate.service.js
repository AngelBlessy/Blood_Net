const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const GOLD = '#b45309';
const DARK_RED = '#b91c1c';
const INK = '#1f2937';
const MUTED = '#6b7280';

const LOGO_PATH = path.join(__dirname, '..', '..', 'client', 'public', 'bloodnet-logo.png');

function drawFrame(doc) {
  const { width, height } = doc.page;
  doc.lineWidth(2).strokeColor(GOLD).roundedRect(18, 18, width - 36, height - 36, 8).stroke();
  doc.lineWidth(0.75).strokeColor(DARK_RED).roundedRect(26, 26, width - 52, height - 52, 6).stroke();

  // Flat-color corner accents in place of the photographic ribbon corners —
  // pdfkit draws vector shapes only, so this keeps the same red/gold motif
  // without needing raster assets.
  doc.polygon([0, 0], [110, 0], [0, 110]).fill(DARK_RED);
  doc.polygon([width, height], [width - 110, height], [width, height - 110]).fill(GOLD);
}

// Streams a decorative "camp-style" donation certificate directly to `res` —
// no temp files, no external rendering service. Every line is placed at an
// explicit y-coordinate rather than relying on pdfkit's flowing cursor, so
// nothing can drift, overlap, or spill onto a second page.
function streamDonationCertificate(res, { donorName, bloodGroup, donationDate, unitsDonated, hospitalName, certificateId }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bloodnet-certificate-${certificateId}.pdf"`);

  const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const contentX = 80;
  const contentWidth = pageWidth - contentX * 2;

  function line(text, y, { size = 12, font = 'Helvetica', color = INK, spacing } = {}) {
    doc
      .fillColor(color)
      .font(font)
      .fontSize(size)
      .text(text, contentX, y, { width: contentWidth, align: 'center', characterSpacing: spacing });
  }

  drawFrame(doc);

  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, pageWidth / 2 - 20, 34, { width: 40, height: 40 });
  }

  line('BloodNet', 78, { size: 28, font: 'Times-Bold', color: DARK_RED });
  line('BLOOD DONATION CAMP', 116, { size: 10.5, spacing: 1.5 });

  line('CERTIFICATE', 146, { size: 30, font: 'Times-Bold', color: DARK_RED });
  line('OF APPRECIATION', 184, { size: 11.5, spacing: 1.5 });

  line('THIS CERTIFICATE IS PROUDLY PRESENTED TO', 214, { size: 9.5, spacing: 1, color: MUTED });

  line(donorName, 234, { size: 22, font: 'Times-BoldItalic' });
  doc
    .moveTo(pageWidth / 2 - 170, 264)
    .lineTo(pageWidth / 2 + 170, 264)
    .lineWidth(1)
    .strokeColor(GOLD)
    .stroke();

  const donatedOn = new Date(donationDate).toLocaleDateString();
  const bodyLine1 =
    `in sincere appreciation for your voluntary donation of ${unitsDonated} unit${unitsDonated === 1 ? '' : 's'} ` +
    `of ${bloodGroup} blood${hospitalName ? ` through ${hospitalName}` : ''} on ${donatedOn}.`;
  line(bodyLine1, 280, { size: 10.5 });
  line('Your act of kindness makes a difference.', 296, { size: 10.5 });

  line('Thank you for being a hero!', 318, { size: 13, font: 'Helvetica-Bold', color: DARK_RED });

  // Bottom block: medal + signature lines, all placed relative to a fixed
  // anchor so it always sits in the same spot regardless of text above.
  const bottomY = 420;
  const centerX = pageWidth / 2;

  doc.circle(centerX, bottomY + 26, 22).lineWidth(1.5).strokeColor(GOLD).stroke();
  doc.circle(centerX, bottomY + 26, 16).fillColor(DARK_RED).fill();
  doc.polygon([centerX - 9, bottomY + 42], [centerX, bottomY + 62], [centerX - 2, bottomY + 41]).fill(DARK_RED);
  doc.polygon([centerX + 9, bottomY + 42], [centerX, bottomY + 62], [centerX + 2, bottomY + 41]).fill(GOLD);

  const sigWidth = 150;
  const leftSigX = centerX - 220;
  const rightSigX = centerX + 70;
  const sigLineY = bottomY + 28;

  doc.moveTo(leftSigX, sigLineY).lineTo(leftSigX + sigWidth, sigLineY).lineWidth(0.75).strokeColor(INK).stroke();
  doc.moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigWidth, sigLineY).stroke();

  doc
    .fillColor(DARK_RED)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('CAMP COORDINATOR', leftSigX, sigLineY + 6, { width: sigWidth, align: 'center', characterSpacing: 0.5 });
  doc.text('ORGANIZING COMMITTEE', rightSigX, sigLineY + 6, { width: sigWidth, align: 'center', characterSpacing: 0.5 });

  doc
    .fillColor(INK)
    .font('Helvetica')
    .fontSize(9.5)
    .text(`DATE: ${donatedOn}`, leftSigX, sigLineY + 30, { width: sigWidth, align: 'center' });
  doc.text(`VENUE: ${hospitalName || 'BloodNet Donation Camp'}`, rightSigX, sigLineY + 30, { width: sigWidth, align: 'center' });

  line(`Certificate ID: ${certificateId}`, sigLineY + 52, { size: 8.5, color: MUTED });

  line('• ONE DONATION CAN SAVE MANY LIVES •', doc.page.height - 44, { size: 10.5, font: 'Helvetica-Bold', color: DARK_RED });

  doc.end();
}

module.exports = { streamDonationCertificate };
