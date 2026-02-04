import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const horarioService = {
  getAllHorarios: async () => {
    const horarios = await prisma.horarios_clases.findMany({
      include: {
        canchas: {
          include: {
            sedes: true,
          },
        },
        niveles_entrenamiento: true,
        profesores: {
          include: {
            usuarios: true,
          },
        },
      },
    });

    return horarios.map((h) => ({
      id: h.id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio.toISOString().substring(11, 16),
      hora_fin: h.hora_fin.toISOString().substring(11, 16),
      capacidad_max: h.capacidad_max,
      activo: h.activo,
      minutos_reserva_especifico: h.minutos_reserva_especifico,
      cancha: {
        id: h.canchas.id,
        nombre: h.canchas.nombre,
        sede: {
          id: h.canchas.sedes.id,
          nombre: h.canchas.sedes.nombre,
        },
      },
      nivel: {
        id: h.niveles_entrenamiento.id,
        nombre: h.niveles_entrenamiento.nombre,
      },
      profesor: {
        id: h.profesores.usuario_id,
        nombre_completo: `${h.profesores.usuarios.nombres} ${h.profesores.usuarios.apellidos}`,
        especializacion: h.profesores.especializacion,
      },
    }));
  },

  createHorario: async (data) => {
    const cancha_id = Number.parseInt(data.cancha_id);
    const profesor_id = Number.parseInt(data.profesor_id);
    const nivel_id = Number.parseInt(data.nivel_id);
    const dia_semana = Number.parseInt(data.dia_semana);

    const [canchaExistente, profesorExistente, nivelExistente] = await Promise.all([
      prisma.canchas.findUnique({ where: { id: cancha_id } }),
      prisma.profesores.findUnique({ where: { usuario_id: profesor_id } }),
      prisma.niveles_entrenamiento.findUnique({ where: { id: nivel_id } }),
    ]);

    if (!canchaExistente) {
      throw new ApiError('La cancha especificada no existe', 404);
    }

    if (!profesorExistente) {
      throw new ApiError('El profesor especificado no existe', 404);
    }

    if (!nivelExistente) {
      throw new ApiError('El nivel de entrenamiento especificado no existe', 404);
    }

    if (dia_semana < 1 || dia_semana > 7) {
      throw new ApiError('El día de la semana debe estar entre 1 (Lunes) y 7 (Domingo)', 400);
    }

    const fechaBase = '1970-01-01T';

    const horaInicioDate = new Date(`${fechaBase}${data.hora_inicio}:00Z`);
    const horaFinDate = new Date(`${fechaBase}${data.hora_fin}:00Z`);

    if (Number.isNaN(horaInicioDate.getTime()) || Number.isNaN(horaFinDate.getTime())) {
      throw new ApiError('Formato de hora inválido. Use HH:MM', 400);
    }

    if (horaFinDate <= horaInicioDate) {
      throw new ApiError('La hora de fin debe ser posterior a la hora de inicio', 400);
    }

    const solapamientoCancha = await prisma.horarios_clases.findFirst({
      where: {
        cancha_id,
        dia_semana,
        activo: true,
        OR: [
          {
            AND: [{ hora_inicio: { lte: horaInicioDate } }, { hora_fin: { gt: horaInicioDate } }],
          },
          {
            AND: [{ hora_inicio: { lt: horaFinDate } }, { hora_fin: { gte: horaFinDate } }],
          },
          {
            AND: [{ hora_inicio: { gte: horaInicioDate } }, { hora_fin: { lte: horaFinDate } }],
          },
        ],
      },
    });

    if (solapamientoCancha) {
      throw new ApiError('Ya existe un horario que se solapa en esta cancha', 400);
    }

    const solapamientoProfesor = await prisma.horarios_clases.findFirst({
      where: {
        profesor_id,
        dia_semana,
        activo: true,
        OR: [
          {
            AND: [{ hora_inicio: { lte: horaInicioDate } }, { hora_fin: { gt: horaInicioDate } }],
          },
          {
            AND: [{ hora_inicio: { lt: horaFinDate } }, { hora_fin: { gte: horaFinDate } }],
          },
          {
            AND: [{ hora_inicio: { gte: horaInicioDate } }, { hora_fin: { lte: horaFinDate } }],
          },
        ],
      },
    });

    if (solapamientoProfesor) {
      throw new ApiError(
        'El profesor ya tiene un horario asignado que se solapa con este rango',
        400
      );
    }

    return await prisma.horarios_clases.create({
      data: {
        cancha_id,
        profesor_id,
        nivel_id,
        dia_semana,
        hora_inicio: horaInicioDate,
        hora_fin: horaFinDate,
        capacidad_max: Number.parseInt(data.capacidad_max || 20),
        minutos_reserva_especifico: data.minutos_reserva_especifico
          ? Number.parseInt(data.minutos_reserva_especifico)
          : null,
        activo: true,
      },
    });
  },

  updateHorario: async () => {},

  deleteHorario: async (id) => {
    const horarioExistente = await prisma.horarios_clases.findUnique({
      where: { id: Number.parseInt(id) },
    });

    if (!horarioExistente) {
      throw new ApiError('El horario especificado no existe', 404);
    }

    return await prisma.horarios_clases.update({
      where: { id: Number.parseInt(id) },
      data: { activo: false },
    });
  },
};
