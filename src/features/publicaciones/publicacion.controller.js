import { publicacionService } from './publicacion.service.js';
import { apiResponse } from '../../shared/utils/response.util.js';
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const publicacionController = {
    createPublicacion: catchAsync(async (req, res) => {
        const data = req.body;
        const imagenFile = req.file; // Extraído por Multer
        console.log('LA DATA:',data);
        // Asignar el autor_id desde el token si no viene en el body
        if (!data.autor_id && req.user) {
            data.autor_id = req.user.id;
        }

        if (!data.titulo || !data.contenido || !data.autor_id) {
            throw new ApiError('El título, contenido y autor_id son obligatorios', 400);
        }
        
        const publicacion = await publicacionService.createPublicacion(data, imagenFile);
        return apiResponse.created(res, {
            message: 'Publicación creada exitosamente',
            data: publicacion,
        });
    }),

    getAllPublicaciones: catchAsync(async (req, res) => {
        const filter = {
            activo: req.query.activo,
            titulo: req.query.titulo,
            page: req.query.page,
            limit: req.query.limit,
        };

        const result = await publicacionService.getAllPublicaciones(filter);
        return apiResponse.success(res, {
            message: 'Publicaciones obtenidas exitosamente',
            data: result.publicaciones,
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
        });
    }),

    getPublicacionById: catchAsync(async (req, res) => {
        const id = Number.parseInt(req.params.id);
        if (Number.isNaN(id)) throw new ApiError('ID de publicación inválido', 400);

        const publicacion = await publicacionService.getPublicacionById(id);
        return apiResponse.success(res, {
            message: 'Publicación obtenida exitosamente',
            data: publicacion,
        });
    }),

    updatePublicacion: catchAsync(async (req, res) => {
        const id = Number.parseInt(req.params.id);
        const data = req.body;
        const imagenFile = req.file; // Por si suben una foto nueva al editar

        if (Number.isNaN(id)) throw new ApiError('ID de publicación inválido', 400);

        const publicacion = await publicacionService.updatePublicacion(id, data, imagenFile);
        return apiResponse.success(res, {
            message: 'Publicación actualizada exitosamente',
            data: publicacion,
        });
    }),

    updateDefusePublicacion: catchAsync(async (req, res) => {
        const id = Number.parseInt(req.params.id);
        if (Number.isNaN(id)) throw new ApiError('ID de publicación inválido', 400);

        await publicacionService.updateDefusePublicacion(id);
        return apiResponse.noContent(res);
    }),

    updateActivePublicacion: catchAsync(async (req, res) => {
        const id = Number.parseInt(req.params.id);
        if (Number.isNaN(id)) throw new ApiError('ID de publicación inválido', 400);

        await publicacionService.updateActivePublicacion(id);
        return apiResponse.noContent(res);
    }),

    deletePublicacion: catchAsync(async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) throw new ApiError('ID de publicación inválido', 400);

        const result = await publicacionService.deletePublicacion(id);
        return apiResponse.success(res, {
            message: result.message,
            data: null,
        });
    }),
};