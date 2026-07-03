/**
 * Transform a Cloudinary URL to serve a resized thumbnail.
 * Non-Cloudinary URLs are returned as-is.
 *
 * @param {string|null} url  - original photo_url from DB
 * @param {number} size      - px (square), default 80
 * @returns {string|null}
 */
export function cloudinaryThumb(url, size = 80) {
  if (!url) return null;
  if (!url.includes('res.cloudinary.com')) return url;
  // Insert transform before /upload/<version-or-public-id>
  // e.g. .../image/upload/students/... → .../image/upload/w_80,h_80,c_fill,q_auto,f_auto/students/...
  return url.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);
}
