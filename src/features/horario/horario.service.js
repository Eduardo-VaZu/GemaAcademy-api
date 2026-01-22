import { prisma } from '../../config/database.js';

export const horarioService = {
  // 1. Listar todos los horarios (con datos "humanos" gracias a include)
  getAllHorarios: async () => {
    return await prisma.horarios_clases.findMany({
      include: {
        canchas: true,               // Trae el nombre de la cancha
        niveles_entrenamiento: true, // Trae el nombre del nivel
        profesores: {
          include: {
            usuarios: true           // Trae el nombre del profesor (no solo su ID)
          }
        }
      }
    });
  },

  // 2. Crear un nuevo horario
  createHorario: async (data) => {
    // TRUCO: Prisma guarda TIME como fecha completa (1970-01-01 + hora).
    // Convertimos el string "09:00" que manda el usuario a un objeto Date.
    const fechaBase = '1970-01-01T'; // Fecha dummy
    
    // Asegúrate de que el usuario envíe "HH:MM" (ej: "18:00")
    const horaInicioDate = new Date(`${fechaBase}${data.hora_inicio}:00Z`); 
    const horaFinDate = new Date(`${fechaBase}${data.hora_fin}:00Z`);

    return await prisma.horarios_clases.create({
      data: {
        cancha_id: parseInt(data.cancha_id),
        profesor_id: parseInt(data.profesor_id),
        nivel_id: parseInt(data.nivel_id),
        dia_semana: parseInt(data.dia_semana), // 1=Lunes, 7=Domingo
        hora_inicio: horaInicioDate,
        hora_fin: horaFinDate,
        capacidad_max: parseInt(data.capacidad_max || 20)
      }
    });
  }
};
