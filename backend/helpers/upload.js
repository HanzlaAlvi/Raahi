'use strict';
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename:    (_, f, cb)  =>
      cb(null, `${f.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(f.originalname)}`),
  }),
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const ok =
      /jpeg|jpg|png|gif/.test(f.mimetype) &&
      /jpeg|jpg|png|gif/.test(path.extname(f.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only image files allowed!'));
  },
});

module.exports = { upload, uploadsDir };