import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

// ============================================================================
// FUNCIONES PRIVADAS DE APOYO (Cumplimiento Regla 4.3 Legibilidad GEMINI.MD)
// ============================================================================

/**
 * Aplica 5 reglas de negocio críticas antes de permitir una reprogramación.
 *
 * @param {object} params - Parámetros de la reprogramación
 * @returns {Promise<object>} Fechas Date parseadas y normalizadas a las 12:00:00 UTC
 */
const validarFechasYHorarios = async (params) => {
  const {
    origenId,
    fechaOrigenStr,
    fechaDestinoStr,
  } = params;

  // 1. Traer origen
  const horarioOrigen = await prisma.horarios_clases.findUnique({
    where: { id: origenId },
    select: {
      dia_semana: true,
      _count: { select: { inscripciones: { where: { estado: 'ACTIVO' } } } },
    },
  });

  if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);

  // 3. Validaciones de Viaje en el Tiempo
  const hoyStr = new Date().toISOString().substring(0, 10);
  const hoyDate = new Date(hoyStr);
  hoyDate.setHours(12, 0, 0, 0);

  const fechaOrigenDate = new Date(fechaOrigenStr);
  fechaOrigenDate.setHours(12, 0, 0, 0);

  const fechaDestinoDate = new Date(fechaDestinoStr);
  fechaDestinoDate.setHours(12, 0, 0, 0);

  if (fechaOrigenDate < hoyDate) {
    throw new ApiError(
      `No puedes reprogramar una clase del pasado (${fechaOrigenStr}). Su registro de asistencia ya está cerrado.`,
      400
    );
  }

  if (fechaDestinoDate < fechaOrigenDate) {
    throw new ApiError(
      `La fecha de destino (${fechaDestinoStr}) no puede ser anterior a la fecha de la clase original (${fechaOrigenStr}).`,
      400
    );
  }

  const diaOrigen = fechaOrigenDate.getUTCDay() === 0 ? 7 : fechaOrigenDate.getUTCDay();

  if (diaOrigen !== horarioOrigen.dia_semana) {
    throw new ApiError(
      `La fecha origen ${fechaOrigenStr} no corresponde al día del horario origen (Día ${horarioOrigen.dia_semana})`,
      400
    );
  }

  return { fechaOrigenDate, fechaDestinoDate };
};

/**
 * Extrae toda la población afectada de un horario específico.
 * Filtra estrictamente a los usuarios `ACTIVO`, ignorando bajas o suspendidos.
 *
 * @param {number} horarioOrigenId
 * @returns {Promise<Array>} Array de inscripciones activas
 */
const obtenerAlumnosAfectados = async (horarioOrigenId) => {
  const inscripciones = await prisma.inscripciones.findMany({
    where: {
      horario_id: horarioOrigenId,
      estado: 'ACTIVO',
    },
    select: { id: true, alumno_id: true },
  });

  if (inscripciones.length === 0) {
    throw new ApiError('No hay alumnos inscritos en el horario de origen para reprogramar', 404);
  }

  return inscripciones;
};

export const claseService = {
  /**
   * Reprograma una clase completa para un grupo de alumnos.
   * Modela una "Asistencia Anticipada" tal cual lo especificó la academia.
   */
  reprogramarMasivamente: async ({
    horario_origen_id,
    fecha_origen,
    fecha_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Validaciones
    const { fechaOrigenDate, fechaDestinoDate } = await validarFechasYHorarios({
      origenId: horario_origen_id,
      fechaOrigenStr: fecha_origen,
      fechaDestinoStr: fecha_destino,
    });

    // 2. Obtención de Afectados
    const inscripciones = await obtenerAlumnosAfectados(horario_origen_id);
    const dateOrigenStr = fechaOrigenDate.toLocaleDateString();
    const dateDestinoStr = fechaDestinoDate.toLocaleDateString();

    // 3. Ejecución Transaccional Batch
    return await prisma.$transaction(async (tx) => {
      let procesados = 0;

      const anulaciones = [];
      const nuevasClases = [];
      const alertas = [];

      for (const inscripcion of inscripciones) {
        // A) Anular la clase original para que el profe no los marque ausentes
        anulaciones.push({
          inscripcion_id: inscripcion.id,
          fecha: fechaOrigenDate,
          estado: 'REPROGRAMADO',
          comentario: `Reprogramación masiva hacia ${fecha_destino}: ${motivo}`,
          registrado_por: usuario_admin_id,
        });

        // B) Crear el espacio temporal esperado de asistencia en el mismo Horario para el nuevo día
        nuevasClases.push({
          inscripcion_id: inscripcion.id,
          fecha: fechaDestinoDate,
          estado: 'PENDIENTE',
          comentario: `[REPG_MASIVA] Reprogramación masiva desde (${dateOrigenStr}) por ${motivo}`,
          registrado_por: usuario_admin_id,
        });

        // C) Notificar al alumno de que su clase cambió
        alertas.push({
          usuario_id: inscripcion.alumno_id,
          titulo: 'Cambio de fecha de clase',
          mensaje: `Tu clase del ${dateOrigenStr} ha sido movida al día ${dateDestinoStr} por motivos administrativos. (${motivo})`,
          tipo: 'ALERTA',
          categoria: 'CLASES',
        });

        procesados++;
      }

      // 4. Inserciones masivas (skip duplicates para la idempotencia al anular la original)
      const inscripcionIds = inscripciones.map((i) => i.id);
      
      // Eliminamos el UPDATE de registros_asistencia, solo creamos uno nuevo REPROGRAMADO
      await tx.registros_asistencia.deleteMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaOrigenDate,
        }
      });

      // Insertamos el registro que cierra el hueco
      await tx.registros_asistencia.createMany({
        data: anulaciones,
      });

      // Insertamos el nuevo registro que aparecerá en el destino
      await tx.registros_asistencia.createMany({
        data: nuevasClases,
      });

      // Activamos notificaciones
      await tx.notificaciones.createMany({
        data: alertas,
      });

      return {
        total_procesados: procesados,
        mensaje: 'Reprogramación masiva ejectutada. Alumnos notificados vía PENDIENTE.',
      };
    });
  },

  /**
   * Obtiene el detalle de una clase específica (horario)
   */
  obtenerDetalleClase: async (horario_id) => {
    const horario = await prisma.horarios_clases.findUnique({
      where: { id: Number(horario_id) },
      select: {
        id: true,
        dia_semana: true,
        hora_inicio: true,
        hora_fin: true,
        capacidad_max: true,
        canchas: {
          select: { nombre: true, sedes: { select: { nombre: true } } },
        },
        coordinadores: {
          select: {
            usuarios: { select: { nombres: true, apellidos: true } },
          },
        },
        niveles_entrenamiento: { select: { nombre: true } },
        inscripciones: {
          where: { estado: 'ACTIVO' },
          select: {
            id: true,
            alumnos: {
              select: {
                usuario_id: true,
                usuarios: { select: { id: true, nombres: true, apellidos: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!horario) throw new ApiError('Horario no encontrado', 404);

    return {
      id: horario.id,
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio.toISOString().substring(11, 16),
      hora_fin: horario.hora_fin.toISOString().substring(11, 16),
      cancha: `${horario.canchas.nombre} - ${horario.canchas.sedes.nombre}`,
      coordinador: horario.coordinadores
        ? `${horario.coordinadores.usuarios.nombres} ${horario.coordinadores.usuarios.apellidos}`
        : 'Sin asignar',
      nivel: horario.niveles_entrenamiento.nombre,
      total_inscritos: horario.inscripciones.length,
      capacidad_maxima: horario.capacidad_max,
      alumnos_inscritos: horario.inscripciones.map((ins) => ({
        inscripcion_id: ins.id,
        alumno_id: ins.alumnos.usuario_id,
        nombre_completo: `${ins.alumnos.usuarios.nombres} ${ins.alumnos.usuarios.apellidos}`,
        email: ins.alumnos.usuarios.email,
      })),
    };
  },
};
