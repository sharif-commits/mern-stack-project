const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Resolve upload path and ensure it exists at runtime
const uploadPath = path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `payment_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024)
  }
});
