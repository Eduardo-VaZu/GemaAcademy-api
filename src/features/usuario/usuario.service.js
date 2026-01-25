import { prisma } from '../../config/database.config.js';
import bcrypt from 'bcryptjs';

export const usuarioService = {
  createUser: async (userData) => {
    const {
      email,
      password,
      tipo_documento_id,
      numero_documento,
      rol_id = 'Alumno',
      datosRolEspecifico = {},
      ...otrosdatos
    } = userData;

    console.log('Iniciando creación de usuario:', email); // LOG DE DEBUG

    try {
      console.log('Verificando email existente...');
      const emailExistente = await prisma.usuarios.findUnique({
        where: {
          email,
        },
      });
      if (emailExistente) {
        throw new Error('El email ya esta registrado');
      }

      const rolNombreBusqueda = rol_id.charAt(0).toUpperCase() + rol_id.slice(1).toLowerCase();
      console.log('Buscando rol:', rolNombreBusqueda);

      const rol = await prisma.roles.findUnique({
        where: {
          nombre: rol_id,
        },
      });
      if (!rol) {
        console.error('Rol no encontrado:', rol_id);
        throw new Error(`El rol '${rol_id}' no existe en la base de datos`);
      }
      console.log('Rol encontrado:', rol.nombre, 'ID:', rol.id);

      console.log('Hasheando contraseña...');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const user = await prisma.$transaction(async (tx) => {
        console.log('Iniciando transacción de BD para usuario:', email); // LOG DE DEBUG
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
    } catch (error) {
      console.error('Error en servicio createUser:', error);
      throw error;
    }
  },
};
