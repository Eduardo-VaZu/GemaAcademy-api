import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

// ============================================================================
// FUNCIONES PRIVADAS DE APOYO (Cumplimiento Regla 4.3 Legibilidad GEMINI.MD)
// ============================================================================

/**
 * Aplica 5 reglas de negocio críticas antes de permitir una reprogramación.
 * 1. Idempotencia: Evita reprogramar un objeto hacia sí mismo.
 * 2. Clases Fantasma: Evita reasignar alumnos a horarios sin un profesor activo.
 * 3. Sobrecupos: Valida matemáticamente que (capacidad - matriculados) soporte la carga entrante.
 * 4. Integridad del Pasado: Impide mover horarios cuyas faltas/asistencias ya fueron auditadas.
 * 5. Viajes Temporales: Impide enviar una clase futura hacia una fecha anterior a la original.
 *
 * @param {number} origenId - ID del horario_clases que falló o se canceló
 * @param {number} destinoId - ID del horario_clases nuevo o de suplencia
 * @param {string} fechaOrigenStr - 'YYYY-MM-DD' Fecha en que se canceló la clase original
 * @param {string} fechaDestinoStr - 'YYYY-MM-DD' Fecha para reponer la clase
 * @returns {Promise<object>} Las fechas Date parseadas y normalizadas a las 12:00:00 UTC
 */
const validarFechasYHorarios = async (origenId, destinoId, fechaOrigenStr, fechaDestinoStr) => {
  if (origenId === destinoId && fechaOrigenStr === fechaDestinoStr) {
    throw new ApiError(
      'El origen y destino son idénticos. No se puede reprogramar una clase hacia sí misma.',
      400
    );
  }

  // Ahora traemos también la capacidad máxima y calculamos cuántos inscritos hay previamente
  const [horarioOrigen, horarioDestino] = await Promise.all([
    prisma.horarios_clases.findUnique({
      where: { id: origenId },
      select: {
        dia_semana: true,
        _count: { select: { inscripciones: { where: { estado: 'ACTIVO' } } } },
      },
    }),
    prisma.horarios_clases.findUnique({
      where: { id: destinoId },
      select: {
        dia_semana: true,
        capacidad_max: true,
        _count: { select: { inscripciones: { where: { estado: 'ACTIVO' } } } },
        coordinadores: {
          select: {
            usuarios: { select: { nombres: true, apellidos: true, activo: true } },
          },
        },
      },
    }),
  ]);

  if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);
  if (!horarioDestino) throw new ApiError('Horario de destino no encontrado', 404);

  if (!horarioDestino.coordinadores || horarioDestino.coordinadores.usuarios.activo === false) {
    const errorPrefix = horarioDestino.coordinadores
      ? `El profesor asignado (${horarioDestino.coordinadores.usuarios.nombres} ${horarioDestino.coordinadores.usuarios.apellidos}) está inactivo en el sistema`
      : 'Ese horario destino no tiene profesor asignado';

    throw new ApiError(
      `${errorPrefix}. No puedes reprogramar alumnos a una clase fantasma o sin profesor disponible.`,
      400
    );
  }

  const cantidadAlumnosAMover = horarioOrigen._count.inscripciones;
  const cuposOcupadosEnDestino = horarioDestino._count.inscripciones;
  const cuposDisponiblesEnDestino = horarioDestino.capacidad_max - cuposOcupadosEnDestino;

  if (cuposDisponiblesEnDestino < cantidadAlumnosAMover) {
    throw new ApiError(
      `Sobrecupo: Intentas mover ${cantidadAlumnosAMover} alumno(s), pero el horario destino solo tiene ${cuposDisponiblesEnDestino} cupos disponibles (Capacidad Max: ${horarioDestino.capacidad_max}). Por favor, crea un nuevo horario exclusivo para esta reprogramación o asigna otro con mayor capacidad.`,
      400
    );
  }

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
  const diaDestino = fechaDestinoDate.getUTCDay() === 0 ? 7 : fechaDestinoDate.getUTCDay();

  if (diaOrigen !== horarioOrigen.dia_semana) {
    throw new ApiError(
      `La fecha origen ${fechaOrigenStr} no corresponde al día del horario origen (Día ${horarioOrigen.dia_semana})`,
      400
    );
  }

  if (diaDestino !== horarioDestino.dia_semana) {
    throw new ApiError(
      `La fecha destino ${fechaDestinoStr} no corresponde al día del horario destino (Día ${horarioDestino.dia_semana})`,
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
 * @returns {Promise<Array>} Array de ids de inscripciones y alumnos
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

/**
 * Motor clasificador para inserciones Batch de Gema Academy.
 * Recibe un bloque de alumnos y cruza sus IDs contra 2 tablas:
 * -> inscripciones (Para evitar que asistan a 2 clases a la misma hora)
 * -> recuperaciones (Para evitar sobreescribir otro ticket ya agendado)
 * Divide a la población en 2 flujos aislados: `paraProgramar` (Éxito) y `paraPendiente` (Conclusión manual).
 *
 * @param {object} tx - Cliente transaccional de Prisma
 * @param {object} params - Desestructuración de ids y variables temporales
 * @returns {Promise<object>} { paraProgramar: [], paraPendiente: [], detalleConflictos: [] }
 */
const detectarConflictosYClasificar = async (tx, params) => {
  const { inscripciones, alumnoIds, horarioDestinoId, fechaDestinoDate, fechaOrigenDate, motivo } =
    params;

  const conflictosInscripcion = await tx.inscripciones.findMany({
    where: {
      horario_id: horarioDestinoId,
      estado: 'ACTIVO',
      alumno_id: { in: alumnoIds },
    },
    select: { alumno_id: true },
  });

  const conflictosRecuperacion = await tx.recuperaciones.findMany({
    where: {
      horario_destino_id: horarioDestinoId,
      fecha_programada: fechaDestinoDate,
      estado: 'PROGRAMADA',
      alumno_id: { in: alumnoIds },
    },
    select: { alumno_id: true },
  });

  const idsConConflicto = new Set([
    ...conflictosInscripcion.map((i) => i.alumno_id),
    ...conflictosRecuperacion.map((r) => r.alumno_id),
  ]);

  const paraProgramar = [];
  const paraPendiente = [];
  const detalleConflictos = [];

  for (const inscripcion of inscripciones) {
    if (idsConConflicto.has(inscripcion.alumno_id)) {
      paraPendiente.push({
        alumno_id: inscripcion.alumno_id,
        fecha_falta: fechaOrigenDate,
        motivo_falta: `INSTITUCIONAL: ${motivo} (Conflicto al reprogramar)`,
        estado: 'PENDIENTE',
        es_por_lesion: false,
      });

      detalleConflictos.push({
        alumno_id: inscripcion.alumno_id,
        razon: 'Conflicto de horario (ya tiene clase o recuperación)',
      });
    } else {
      paraProgramar.push({
        alumno_id: inscripcion.alumno_id,
        fecha_falta: fechaOrigenDate,
        motivo_falta: `INSTITUCIONAL: ${motivo}`,
        estado: 'PROGRAMADA',
        es_por_lesion: false,
        horario_destino_id: horarioDestinoId,
        fecha_programada: fechaDestinoDate,
      });
    }
  }

  return { paraProgramar, paraPendiente, detalleConflictos };
};

/**
 * Justifica institucionalmente el no-show de la clase original (Audit Trail).
 * Efectúa un update masivo (`updateMany`) sobre registros existentes
 * o un `createMany` (sin fallar por duplicados) sobre registros inexistentes.
 *
 * @returns {Promise<void>}
 */
const procesarAsistenciasEnLote = async (tx, params) => {
  const { inscripciones, inscripcionIds, fechaOrigenDate, motivo, usuario_admin_id } = params;
  const comentarioAdmin = `Reprogramado masivamente por: ${motivo}. Admin: ${usuario_admin_id}`;

  await tx.registros_asistencia.updateMany({
    where: {
      inscripcion_id: { in: inscripcionIds },
      fecha: fechaOrigenDate,
    },
    data: {
      estado: 'SUSPENDIDO',
      comentario: comentarioAdmin,
    },
  });

  const asistenciasParaCrear = inscripciones.map((ins) => ({
    inscripcion_id: ins.id,
    fecha: fechaOrigenDate,
    estado: 'SUSPENDIDO',
    comentario: comentarioAdmin,
    registrado_por: usuario_admin_id,
  }));

  await tx.registros_asistencia.createMany({
    data: asistenciasParaCrear,
    skipDuplicates: true,
  });
};

/**
 * Genera compensaciones compensatorias ("Tickets") en base de datos.
 * Usa `skipDuplicates: true` como mecanismo Anti-Race Condition,
 * absorbiendo errores 500 si un administrador envía la petición múltiples veces
 * rápidamente debido a mal internet.
 *
 * @returns {Promise<void>}
 */
const generarRecuperacionesEnLote = async (tx, paraProgramar, paraPendiente) => {
  if (paraProgramar.length > 0) {
    await tx.recuperaciones.createMany({
      data: paraProgramar,
      skipDuplicates: true,
    });
  }

  if (paraPendiente.length > 0) {
    await tx.recuperaciones.createMany({
      data: paraPendiente,
      skipDuplicates: true,
    });
  }
};
export const claseService = {
  /**
   * Reprograma una clase completa para un grupo de alumnos.
   * Mueve la clase de una fecha/horario origen a una fecha/horario destino.
   */
  reprogramarMasivamente: async ({
    horario_origen_id,
    fecha_origen,
    horario_destino_id,
    fecha_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Validaciones
    const { fechaOrigenDate, fechaDestinoDate } = await validarFechasYHorarios(
      horario_origen_id,
      horario_destino_id,
      fecha_origen,
      fecha_destino
    );

    // 2. Obtención de Afectados
    const inscripciones = await obtenerAlumnosAfectados(horario_origen_id);
    const alumnoIds = inscripciones.map((i) => i.alumno_id);
    const inscripcionIds = inscripciones.map((i) => i.id);

    // 3. Ejecución Transaccional Batch
    return await prisma.$transaction(async (tx) => {
      // 3.A Detección de Conflictos
      const { paraProgramar, paraPendiente, detalleConflictos } =
        await detectarConflictosYClasificar(tx, {
          inscripciones,
          alumnoIds,
          horarioDestinoId: horario_destino_id,
          fechaDestinoDate,
          fechaOrigenDate,
          motivo,
        });

      // 3.B Suspensión de Asistencia Masiva
      await procesarAsistenciasEnLote(tx, {
        inscripciones,
        inscripcionIds,
        fechaOrigenDate,
        motivo,
        usuario_admin_id,
      });

      // 3.C Creación de Recuperaciones
      await generarRecuperacionesEnLote(tx, paraProgramar, paraPendiente);

      return {
        total_procesados: inscripciones.length,
        reprogramados_exitosamente: paraProgramar.length,
        pendientes_por_conflicto: paraPendiente.length,
        detalle_conflictos: detalleConflictos,
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
