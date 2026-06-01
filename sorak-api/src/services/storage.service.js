import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

if (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  logger.info(`Cloudinary ready — cloud: ${env.cloudinary.cloudName}`);
} else {
  logger.warn('Cloudinary credentials not set — storage disabled');
}

function assertConfig() {
  if (!env.cloudinary.cloudName) throw new Error('Cloudinary credentials not configured');
}

function bufferToStream(buffer) {
  const r = new Readable();
  r.push(buffer);
  r.push(null);
  return r;
}

/**
 * Upload image buffer to Cloudinary.
 * key example: "students/184/photo_1748591234"  (no extension — Cloudinary manages that)
 * Returns { key: public_id, url: secure_url }
 */
export async function upload(key, body, _contentType) {
  assertConfig();
  // Strip extension from key to use as public_id
  const publicId = key.replace(/\.[^/.]+$/, '');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        resolve({ key: result.public_id, url: result.secure_url });
      },
    );
    bufferToStream(body).pipe(stream);
  });
}

/**
 * Delete image from Cloudinary by public_id (or key with extension).
 */
export async function deleteObject(key) {
  assertConfig();
  const publicId = key.replace(/\.[^/.]+$/, '');
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

/**
 * Cloudinary URLs are already public — return as-is.
 */
export async function presign(key) {
  return key;
}
