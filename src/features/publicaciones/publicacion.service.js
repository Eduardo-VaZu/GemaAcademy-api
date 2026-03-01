import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';
import { uploadToCloudinary } from '../cloudinaryImg/cloudinary.service.js';

const PUBLICACION_SELECT_FIELDS = {
  id: true,
  titulo: true,
  contenido: true,
  imagen_url: true,
  activo: true,
  creado_en: true,
  actualizado_en: true,
  administrador: {
    select: {
      usuarios: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
  },
};

export const publicacionService = {
  createPublicacion: async (data, imagenFile) => {
    // 1. Validar que el administrador exista
    const adminRelacion = await prisma.administrador.findUnique({
      where: { usuario_id: Number.parseInt(data.autor_id) },
    });

    if (!adminRelacion) {
      throw new ApiError('Administrador (autor) no válido o no encontrado', 404);
    }

    let imageUrl = null;

    // 2. Subir imagen a Cloudinary si existe
    if (imagenFile) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(imagenFile, 'publicaciones');
        imageUrl = cloudinaryResponse.url;
      } catch (error) {
        throw new ApiError(`Error al subir la imagen a Cloudinary: ${error.message}`, 500);
      }
    }

    // 3. Crear registro en BD
    return await prisma.publicaciones.create({
      data: {
        titulo: data.titulo,
        contenido: data.contenido,
        imagen_url: imageUrl,
        autor_id: adminRelacion.usuario_id,
        activo: true,
      },
      select: PUBLICACION_SELECT_FIELDS,
    });
  },

  getAllPublicaciones: async (filters = {}) => {
    let { activo, titulo, page = 1, limit = 10 } = filters;
    page = Number.parseInt(page, 10);
    limit = Number.parseInt(limit, 10);

    const where = {};

    if (activo !== undefined) {
      where.activo = String(activo) === 'true';
    }

    if (titulo) {
      where.titulo = {
        contains: titulo,
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * limit;

    const [publicaciones, total] = await Promise.all([
      prisma.publicaciones.findMany({
        where,
        select: PUBLICACION_SELECT_FIELDS,
        orderBy: { creado_en: 'desc' }, // Las más nuevas primero
        skip,
        take: limit,
      }),
      prisma.publicaciones.count({ where }),
    ]);

    return {
      publicaciones,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  getPublicacionById: async (id) => {
    const publicacion = await prisma.publicaciones.findUnique({
      where: { id: parseInt(id) },
      select: PUBLICACION_SELECT_FIELDS,
    });

    if (!publicacion) throw new ApiError('Publicación no encontrada', 404);
    return publicacion;
  },

  updatePublicacion: async (id, data, imagenFile) => {
    const publicacionId = parseInt(id);

    const existe = await prisma.publicaciones.findUnique({ where: { id: publicacionId } });
    if (!existe) throw new ApiError('Publicación no encontrada', 404);

    let nuevaImageUrl = existe.imagen_url;

    // Si envían una nueva foto al actualizar, la subimos a Cloudinary
    if (imagenFile) {
      try {
        const cloudinaryResponse = await uploadToCloudinary(imagenFile, 'publicaciones');
        nuevaImageUrl = cloudinaryResponse.url;
      } catch (error) {
        throw new ApiError(`Error al subir la nueva imagen a Cloudinary: ${error.message}`, 500);
      }
    }

    return await prisma.publicaciones.update({
      where: { id: publicacionId },
      data: {
        ...(data.titulo && { titulo: data.titulo }),
        ...(data.contenido && { contenido: data.contenido }),
        imagen_url: nuevaImageUrl, // Se mantiene la anterior o se guarda la nueva
        ...(data.activo !== undefined && { activo: data.activo }),
      },
      select: PUBLICACION_SELECT_FIELDS,
    });
  },

  updateDefusePublicacion: async (id) => {
    return await prisma.publicaciones.update({
      where: { id: parseInt(id) },
      data: { activo: false },
    });
  },

  updateActivePublicacion: async (id) => {
    return await prisma.publicaciones.update({
      where: { id: parseInt(id) },
      data: { activo: true },
    });
  },

  deletePublicacion: async (id) => {
    const publicacionId = parseInt(id);
    const existe = await prisma.publicaciones.findUnique({ where: { id: publicacionId } });
    
    if (!existe) throw new ApiError('Publicación no encontrada', 404);

    await prisma.publicaciones.delete({
      where: { id: publicacionId },
    });

    return { success: true, message: 'Publicación eliminada correctamente' };
  },
};