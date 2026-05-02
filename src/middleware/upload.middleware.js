const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.resolve(process.cwd(), 'uploads');
const driverKycDir = path.join(uploadRoot, 'driver-kyc');

fs.mkdirSync(driverKycDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, driverKycDir);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeFieldName = String(file.fieldname || 'file').replace(/[^a-z0-9_-]/gi, '_');
    cb(null, `${Date.now()}_${safeFieldName}${extension}`);
  }
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Only JPG, PNG, and WEBP images are supported'));
      return;
    }

    cb(null, true);
  }
});

module.exports = {
  upload,
  uploadRoot
};
