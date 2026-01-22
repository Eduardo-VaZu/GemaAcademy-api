
import { usuarioService } from "./usuario.service.js";

export const usuarioController = {
    register: async (req, res) => {
        try {
            const usuario = await usuarioService.createUser(req.body);

            res.status(201).json({
                status: 'success',
                message: 'Usuario creado exitosamente',
                data: usuario
            });
        } catch (error) {
            // Errores de validación o duplicados
            if (error.message.includes('ya está registrado')) {
                return res.status(400).json({
                    status: 'error',
                    message: error.message
                });
            }

            // Error de Prisma por violación de constraint
            if (error.code === 'P2002') {
                return res.status(400).json({
                    status: 'error',
                    message: 'El email ya está registrado'
                });
            }

            res.status(500).json({
                status: 'error',
                message: 'Error al crear usuario',
                detail: error.message
            });
        }
    },
}
