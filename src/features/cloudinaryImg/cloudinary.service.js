import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config/cloudinary.config';

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

if (config.cloudinary.cloud_name && config.cloudinary.api_key && config.cloudinary.api_secret) {
  console.log('✅ Cloudinary configurado correctamente');
}

export const uploadToCloudinary = async (fileObject) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'yape',
        public_id: `${Date.now()}_${fileObject.originalname.replace(/\.[^/.]+$/, '')}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      }
    );

    uploadStream.end(fileObject.buffer);
  });
};
