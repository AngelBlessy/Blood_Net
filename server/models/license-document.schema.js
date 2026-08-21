const mongoose = require('mongoose');

// An uploaded registration/license proof (hospital or blood bank), stored
// directly in MongoDB rather than on local disk -- local disk on most PaaS
// hosts (Fly.io included) is ephemeral and would silently lose every
// uploaded document on a redeploy or restart. License documents are small
// (multer caps uploads at 5MB, see middleware/upload.js), well under the
// 16MB BSON document limit, so embedding the bytes here is simplest.
const licenseDocumentSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

module.exports = { licenseDocumentSchema };
