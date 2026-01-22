
import { prisma } from "../../config/database.js";
import bcrypt from "bcryptjs";

export const usuarioService = {
    createUser: async (userData) => {
        const { email, password, ...otrosdatos } = userData;
        const emailExistente = await prisma.usuarios.findUnique({
            where: {
                email: email
            }
        });
        if (emailExistente) {
            throw new Error("El email ya esta registrado");
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = await prisma.$transaction(async (tx) => {
            const nuevoUsuario = await tx.usuarios.create({
                data: {
                    email,
                    ...otrosdatos,
                    activo: true
                },
                include: {
                    roles: true
                }
            });
            await tx.credenciales_usuario.create({
                data: {
                    usuario_id: nuevoUsuario.id,
                    hash_contrasena: hashedPassword
                }
            });
            return nuevoUsuario;
        });
        return {
            id: user.id,
            email: user.email,
            nombres: user.nombres,
            apellidos: user.apellidos,
            rol: user.roles.nombre
        };
    }
}
