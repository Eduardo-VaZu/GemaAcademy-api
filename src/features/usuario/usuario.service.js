import { prisma } from '../../config/database.js';
import bcrypt from 'bcryptjs';

export const usuarioService = {
  createUser: async (userData) => {
    const {
      email,
      password,
      tipo_documento_id,
      numero_documento,
      rol_id = 'alumno',
      datosRolEspecifico = {},
      ...otrosdatos
    } = userData;

    const emailExistente = await prisma.usuarios.findUnique({
      where: {
        email: email,
      },
    });
    if (emailExistente) {
      throw new Error('El email ya esta registrado');
    }

    const rol = await prisma.roles.findUnique({
      where: {
        nombre: rol_id.toLowerCase(),
      },
    });
    if (!rol) {
      throw new Error(`El rol '${rol_id}' no existe en la base de datos`);
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuarios.create({
        data: {
          email,
          rol_id: rol.id,
          tipo_documento_id: tipo_documento_id || null,
          numero_documento: numero_documento || null,
          ...otrosdatos,
          activo: true,
        },
      });

      await tx.credenciales_usuario.create({
        data: {
          usuario_id: nuevoUsuario.id,
          hash_contrasena: hashedPassword,
        },
      });

      const rolNombre = rol.nombre.toLowerCase();

      if (rolNombre === 'alumno') {
        await tx.alumnos.create({
          data: {
            usuario_id: nuevoUsuario.id,
            condiciones_medicas: datosRolEspecifico.condiciones_medicas || null,
            seguro_medico: datosRolEspecifico.seguro_medico || null,
            grupo_sanguineo: datosRolEspecifico.grupo_sanguineo || null,
          },
        });
      } else if (rolNombre === 'profesor') {
        await tx.profesores.create({
          data: {
            usuario_id: nuevoUsuario.id,
            especializacion: datosRolEspecifico.especializacion || null,
            tarifa_hora: datosRolEspecifico.tarifa_hora || null,
          },
        });
      } else if (rolNombre === 'administrador') {
        if (!datosRolEspecifico.cargo) {
          throw new Error('El campo "cargo" es obligatorio para administradores');
        }
        await tx.administrador.create({
          data: {
            usuario_id: nuevoUsuario.id,
            cargo: datosRolEspecifico.cargo,
            sede_id: datosRolEspecifico.sede_id || null,
            area: datosRolEspecifico.area || null,
          },
        });
      }

      return nuevoUsuario;
    });

    return {
      id: user.id,
      email: user.email,
      nombres: user.nombres,
      apellidos: user.apellidos,
      rol: rol.nombre,
    };
  },
};
