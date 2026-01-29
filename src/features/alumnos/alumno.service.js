import { prisma } from '../../config/database.config.js';

export const alumnoService = {
  getAllAlumnos: async (filtro = {}) => {
    const { activo = true, page = 1, limit = 10 } = filtro;

    const where = {
      usuario: {
        activo: activo !== undefined ? activo : true,
      },
    };

    const skip = (page - 1) * limit;

    const [alumnos, total] = await prisma.$transaction([
      prisma.alumno.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              email: true,
              nombres: true,
              apellidos: true,
              telefono_personal: true,
              fecha_nacimiento: true,
              genero: true,
              creado_en: true,
              activo: true,
            },
          },
          inscripciones: {
            where: { estado: 'ACTIVO' },
            select: { id: true, horario_id: true, estado: true },
          },
          cuentas_por_cobrar: {
            where: { estado: 'PENDIENTE' },
            select: { id: true, monto_final: true },
          },
          orderBy: {
            usuario: { nombres: 'asc' },
          },
        },
        skip,
        take: limit,
      }),
      prisma.alumno.count({ where }),
    ]);

    return {
      data: alumnos.map((alumno) => formatAlumnoResponse(alumno)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
};

function formatAlumnoResponse(alumno) {
  return {
    id: alumno.usuarios.id,
    email: alumno.usuarios.email,
    nombres: alumno.usuarios.nombres,
    apellidos: alumno.usuarios.apellidos,
    telefono: alumno.usuarios.telefono_personal,
    inscripciones_activas: alumno.inscripciones.length,
    deuda_pendiente: alumno.cuentas_por_cobrar.reduce(
      (sum, c) => sum + parseFloat(c.monto_final),
      0
    ),
    datos_medicos: {
      condiciones: alumno.condiciones_medicas,
      seguro: alumno.seguro_medico,
      grupo_sanguineo: alumno.grupo_sanguineo,
    },
  };
}
