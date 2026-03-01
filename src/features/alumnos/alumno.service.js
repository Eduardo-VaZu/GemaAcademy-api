import { prisma } from '../../config/database.config.js';

export const alumnoService = {
  // =================================================================
  // 🛡️ ACTUALIZACIÓN SEGURA DE PERFIL (Solo campos permitidos)
  // =================================================================
  actualizarMiPerfil: async (usuarioId, datosPermitidos) => {
    return await prisma.$transaction(async (tx) => {
      // 1. EXTRAEMOS SOLO LO PERMITIDO (Ignoramos el resto del req.body)
      const {
        // De la tabla 'usuarios'
        email,
        telefono_personal,
        fecha_nacimiento,
        // De la tabla 'alumnos'
        condiciones_medicas,
        seguro_medico,
        grupo_sanguineo,
        // De la tabla 'direcciones'
        direccion_completa,
        distrito,
        ciudad,
        referencia
      } = datosPermitidos;

      // ---------------------------------------------------------
      // 2. ACTUALIZAR USUARIO
      // ---------------------------------------------------------
      const dataUsuario = {};
      if (email !== undefined) dataUsuario.email = email;
      if (telefono_personal !== undefined) dataUsuario.telefono_personal = telefono_personal;
      if (fecha_nacimiento !== undefined) dataUsuario.fecha_nacimiento = new Date(fecha_nacimiento);

      if (Object.keys(dataUsuario).length > 0) {
        await tx.usuarios.update({
          where: { id: parseInt(usuarioId) },
          data: dataUsuario
        });
      }

      // ---------------------------------------------------------
      // 3. RECUPERAR ALUMNO ACTUAL PARA VER SU DIRECCIÓN
      // ---------------------------------------------------------
      const alumnoActual = await tx.alumnos.findUnique({
        where: { usuario_id: parseInt(usuarioId) }
      });

      if (!alumnoActual) throw new Error('Alumno no encontrado en el sistema.');

      // ---------------------------------------------------------
      // 4. ACTUALIZAR O CREAR DIRECCIÓN
      // ---------------------------------------------------------
      let nuevaDireccionId = alumnoActual.direccion_id;
      const hayDatosDireccion = direccion_completa || distrito || ciudad || referencia;

      if (hayDatosDireccion) {
        const dataDireccion = {
          ...(direccion_completa && { direccion_completa }),
          ...(distrito && { distrito }),
          ...(ciudad && { ciudad }),
          ...(referencia && { referencia })
        };

        if (alumnoActual.direccion_id) {
          // Si ya tiene dirección, la actualizamos
          await tx.direcciones.update({
            where: { id: alumnoActual.direccion_id },
            data: dataDireccion
          });
        } else {
          // Si no tiene dirección registrada, creamos una nueva
          // Validamos los requeridos por Prisma
          if (!direccion_completa || !distrito) {
            throw new Error('Para registrar una dirección nueva, necesitas enviar direccion_completa y distrito.');
          }
          const nuevaDireccion = await tx.direcciones.create({
            data: {
              ...dataDireccion,
              ciudad: dataDireccion.ciudad || "Lima" // Valor por defecto
            }
          });
          nuevaDireccionId = nuevaDireccion.id;
        }
      }

      // ---------------------------------------------------------
      // 5. ACTUALIZAR ALUMNO
      // ---------------------------------------------------------
      const dataAlumno = {};
      if (condiciones_medicas !== undefined) dataAlumno.condiciones_medicas = condiciones_medicas;
      if (seguro_medico !== undefined) dataAlumno.seguro_medico = seguro_medico;
      if (grupo_sanguineo !== undefined) dataAlumno.grupo_sanguineo = grupo_sanguineo;
      
      // Vinculamos la nueva dirección si es que se creó una
      if (nuevaDireccionId !== alumnoActual.direccion_id) {
        dataAlumno.direccion_id = nuevaDireccionId;
      }

      if (Object.keys(dataAlumno).length > 0) {
        await tx.alumnos.update({
          where: { usuario_id: parseInt(usuarioId) },
          data: dataAlumno
        });
      }

      // ---------------------------------------------------------
      // 6. RETORNAR EL PERFIL ACTUALIZADO
      // ---------------------------------------------------------
      return await tx.usuarios.findUnique({
        where: { id: parseInt(usuarioId) },
        select: {
          nombres: true,
          apellidos: true,
          email: true,
          telefono_personal: true,
          fecha_nacimiento: true,
          alumnos: {
            select: {
              condiciones_medicas: true,
              seguro_medico: true,
              grupo_sanguineo: true,
              direcciones: true
            }
          }
        }
      });
    });
  }
};