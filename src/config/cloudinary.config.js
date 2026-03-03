import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../shared/utils/logger.util.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
  logger.info('[Cloudinary] Configurado correctamente');
}

export { cloudinary };
