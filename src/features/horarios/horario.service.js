import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const horarioService = {
  // 1. Listar todos los horarios
  getAllHorarios: async () => {
    return await prisma.horarios_clases.findMany({
      include: {
        canchas: true,
        niveles_entrenamiento: true,
        profesores: {
          include: {
            usuarios: true,
          },
        },
      },
    });
  },

  // 2. Crear un nuevo horario
  createHorario: async (data) => {
    const { cancha_id, profesor_id, nivel_id } = data;

    const canchaExistente = await prisma.canchas.findUnique({
      where: { id: cancha_id },
    });

    if (!canchaExistente) {
      throw new ApiError('La cancha que intenta crear no existe', 404);
    }

    const profesorExistente = await prisma.profesores.findUnique({
      where: { id: profesor_id },
    });

    if (!profesorExistente) {
      throw new ApiError('El profesor que intenta crear no existe', 404);
    }

    const nivelExistente = await prisma.niveles_entrenamiento.findUnique({
      where: { id: nivel_id },
    });

    if (!nivelExistente) {
      throw new ApiError('El nivel que intenta crear no existe', 404);
    }

    // TRUCO: Prisma guarda TIME como fecha completa.
    const fechaBase = '1970-01-01T';

    // Aseguramos formato HH:MM
    const horaInicioDate = new Date(`${fechaBase}${data.hora_inicio}:00Z`);
    const horaFinDate = new Date(`${fechaBase}${data.hora_fin}:00Z`);

    return await prisma.horarios_clases.create({
      data: {
        cancha_id: parseInt(data.cancha_id),
        profesor_id: parseInt(data.profesor_id),
        nivel_id: parseInt(data.nivel_id),
        dia_semana: parseInt(data.dia_semana),
        hora_inicio: horaInicioDate,
        hora_fin: horaFinDate,
        capacidad_max: parseInt(data.capacidad_max || 20),

        // 👇 AQUÍ AGREGAMOS LA LÓGICA DEL NUEVO CAMPO
        // Si viene un dato, lo guardamos como número.
        // Si no viene nada, guardamos NULL (para que use la config global).
        minutos_reserva_especifico: data.minutos_reserva_especifico
          ? parseInt(data.minutos_reserva_especifico)
          : null,

        activo: true,
      },
    });
  },
};
