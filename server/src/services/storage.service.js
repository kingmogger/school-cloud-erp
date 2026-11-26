import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadFile(file, folder = 'schll') {
  if (!file) return null;

  if (hasCloudinary) {
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: 'auto',
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  // Local fallback for development when Cloudinary keys are not provided
  const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads', folder);
  await fs.mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fullPath = path.join(uploadDir, safeName);
  await fs.writeFile(fullPath, file.buffer);
  return { url: `/uploads/${folder}/${safeName}`, publicId: safeName };
}
