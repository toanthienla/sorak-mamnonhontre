import multer from 'multer';
import { BadRequest } from '../utils/http-error.js';

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
]);

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) {
      return cb(BadRequest('Chỉ chấp nhận ảnh JPG/PNG/WEBP'));
    }
    cb(null, true);
  },
});

export const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const okMime = ALLOWED_MIME.has(file.mimetype);
    const okExt = /\.xlsx$/i.test(file.originalname);
    if (!okMime && !okExt) {
      return cb(BadRequest('Only .xlsx files are allowed'));
    }
    cb(null, true);
  },
});
