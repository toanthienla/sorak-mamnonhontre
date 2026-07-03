import multer from 'multer';
import { BadRequest } from '../utils/http-error.js';

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) {
      return cb(BadRequest('Chỉ chấp nhận ảnh JPG/PNG/WEBP'));
    }
    cb(null, true);
  },
}).single('photo');

// Run multer single-file upload + enforce the file is present.
// Handles BOTH failure cases (type/size via multer, missing via req.file) in one layer.
export function uploadPhoto(req, res, next) {
  upload(req, res, (err) => {
    if (err) return next(err); // type / size error from multer
    if (!req.file) return next(BadRequest('Thiếu file ảnh')); // no file in request
    next();
  });
}

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
