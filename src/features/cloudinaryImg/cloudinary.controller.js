import { uploadToCloudinary } from './cloudinary.service.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    const cloudinaryResponse = await uploadToCloudinary(req.file);

    res.status(200).json({
      message: 'Imagen subida exitosamente',
      url: cloudinaryResponse.url,
      publicId: cloudinaryResponse.publicId,
      format: cloudinaryResponse.format,
      size: cloudinaryResponse.bytes,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al subir la imagen',
      details: error.message,
    });
  }
};
