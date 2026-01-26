import { prisma } from '../../config/database.config.js';

export const inscripcionService = {
  
  // Crear una nueva inscripción (Con validación de cupos)
  inscribirAlumno: async (data) => {
    const { alumno_id, horario_id } = data;

    // 1. Buscamos el horario para saber su capacidad máxima
    const horario = await prisma.horarios_clases.findUnique({
      where: { id: parseInt(horario_id) },
    });

    if (!horario) {
      throw new Error('El horario indicado no existe.');
    }

    // 2. Contamos cuántos alumnos hay inscritos ACTUALMENTE (solo los ACTIVOS)
    const inscritosActuales = await prisma.inscripciones.count({
      where: {
        horario_id: parseInt(horario_id),
        estado: 'ACTIVO', // No contamos a los retirados o cancelados
      },
    });

    // 3. VERIFICACIÓN DE AFORO (La lógica de negocio)
    if (inscritosActuales >= horario.capacidad_max) {
      throw new Error('SOLD_OUT'); // Lanzamos un error específico
    }

    // 4. Si hay espacio, procedemos a crear la inscripción
    // Prisma nos protegerá de duplicados gracias al @@unique en la base de datos
    return await prisma.inscripciones.create({
      data: {
        alumno_id: parseInt(alumno_id),
        horario_id: parseInt(horario_id),
        estado: 'ACTIVO',
        fecha_inscripcion: new Date(), // Fecha de hoy
      },
      // Incluimos datos para devolver una respuesta bonita
      include: {
        alumnos: {
          include: { usuarios: true } // Para ver el nombre del alumno
        },
        horarios_clases: {
          include: { canchas: true } // Para ver dónde es la clase
        }
      }
    });
  },

  // Obtener todas las inscripciones (útil para el admin)
  getAllInscripciones: async () => {
    return await prisma.inscripciones.findMany({
      include: {
        alumnos: {
          select: {
            usuarios: {
              select: { nombres: true, apellidos: true, email: true }
            }
          }
        },
        horarios_clases: {
          include: {
            niveles_entrenamiento: true,
            canchas: true
          }
        }
      },
      orderBy: { fecha_inscripcion: 'desc' }
    });
  }
};