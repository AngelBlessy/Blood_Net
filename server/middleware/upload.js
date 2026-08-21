const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Memory storage, not disk -- the uploaded bytes end up embedded directly in
// the HospitalProfile/BloodBankProfile document in MongoDB (see
// license-document.schema.js), not written to the filesystem. req.file.buffer
// holds the contents; there is no req.file.path to clean up on failure.
const single = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, or PNG files are allowed.'));
    }
    cb(null, true);
  },
}).single('licenseDocument');

// Wraps multer's callback-style middleware so upload errors (wrong file
// type, over the size limit) come back as a normal 400 JSON response instead
// of falling through to the generic 500 error handler. A request with no
// file at all is not an error here -- registration validates that itself,
// since the field is only required for hospital/bloodbank roles.
function uploadLicenseDocument(req, res, next) {
  single(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: error.message || 'Could not upload the document.' });
  });
}

module.exports = { uploadLicenseDocument };
