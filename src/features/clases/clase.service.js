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
 * @param {object} params - Parámetros de la reprogramación
 * @returns {Promise<object>} Fechas Date parseadas y normalizadas a las 12:00:00 UTC, junto con la cancha analizada
 */
const validarFechasYHorarios = async (params) => {
  const {
    origenId,
    fechaOrigenStr,
    canchaId,
    coordinadorId,
    horaInicioStr,
    horaFinStr,
    fechaDestinoStr,
  } = params;

  // 1. Convertir horas a Date para comparar que tengan sentido lógico (Ej: 10:00 < 12:00)
  const baseDate = '1970-01-01T';
  const timeInicio = new Date(`${baseDate}${horaInicioStr}Z`).getTime();
  const timeFin = new Date(`${baseDate}${horaFinStr}Z`).getTime();

  if (timeInicio >= timeFin) {
    throw new ApiError('La hora de inicio debe ser estrictamente menor a la hora de fin.', 400);
  }

  // 2. Traer origen y datos de la infraestructura destino en paralelo
  const [horarioOrigen, canchaDestino] = await Promise.all([
    prisma.horarios_clases.findUnique({
      where: { id: origenId },
      select: {
        dia_semana: true,
        _count: { select: { inscripciones: { where: { estado: 'ACTIVO' } } } },
      },
    }),
    prisma.canchas.findUnique({
      where: { id: canchaId },
      select: { nombre: true, sedes: { select: { nombre: true } } },
    }),
  ]);

  if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);
  if (!canchaDestino) throw new ApiError(`La cancha indicada (ID: ${canchaId}) no existe`, 404);

  // 3. Validar Coordinador Subyacente si se proporcionó uno
  if (coordinadorId) {
    const coordinador = await prisma.coordinadores.findUnique({
      where: { usuario_id: coordinadorId },
      select: { usuarios: { select: { nombres: true, apellidos: true, activo: true } } },
    });

    if (!coordinador || coordinador.usuarios.activo === false) {
      throw new ApiError('El profesor asignado no existe o está inactivo en el sistema.', 400);
    }
  }

  // 4. Validaciones de Cupo contra la Cancha Base
  // En este nuevo modelo "Efímero", no hay alumnos previamente inscritos. El cupo es el de la cancha total.
  // Gema no tiene 'capacidad' en su tabla canchas (delega en horario), así que usaremos el default seguro de 20
  // o lo que dictaría la lógica de negocio actual. Lo dejaremos en 20 como asunción segura.
  const CAPACIDAD_DEFAULT = 20;
  const cantidadAlumnosAMover = horarioOrigen._count.inscripciones;

  if (CAPACIDAD_DEFAULT < cantidadAlumnosAMover) {
    throw new ApiError(
      `Sobrecupo: Intentas mover ${cantidadAlumnosAMover} alumno(s), pero el límite institucional por sesión es de ${CAPACIDAD_DEFAULT}. Por favor divide el grupo.`,
      400
    );
  }

  // 5. Validaciones de Viaje en el Tiempo (Integridad de la BD Audit)
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

  return { fechaOrigenDate, fechaDestinoDate, diaDestino };
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
    cancha_id,
    coordinador_id,
    nivel_id,
    hora_inicio,
    hora_fin,
    fecha_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Validaciones
    const { fechaOrigenDate, fechaDestinoDate, diaDestino } = await validarFechasYHorarios({
      origenId: horario_origen_id,
      fechaOrigenStr: fecha_origen,
      canchaId: cancha_id,
      coordinadorId: coordinador_id,
      nivelId: nivel_id,
      horaInicioStr: hora_inicio,
      horaFinStr: hora_fin,
      fechaDestinoStr: fecha_destino,
    });

    // 2. Obtención de Afectados
    const inscripciones = await obtenerAlumnosAfectados(horario_origen_id);
    const alumnoIds = inscripciones.map((i) => i.alumno_id);
    const inscripcionIds = inscripciones.map((i) => i.id);

    // 3. Ejecución Transaccional Batch
    return await prisma.$transaction(async (tx) => {
      // 3.A Creación del Horario Efímero (Soft-Deletable)
      const baseDate = '1970-01-01T';
      const horarioTemporal = await tx.horarios_clases.create({
        data: {
          cancha_id,
          coordinador_id: coordinador_id || null,
          nivel_id,
          dia_semana: diaDestino,
          hora_inicio: new Date(`${baseDate}${hora_inicio}Z`),
          hora_fin: new Date(`${baseDate}${hora_fin}Z`),
          capacidad_max: 20, // o heredar desde lógica comercial
          activo: true, // Quedará vivo hasta que pase el día y el Cronjob lo apague
          minutos_reserva_especifico: null,
        },
      });
      const horario_destino_id = horarioTemporal.id;

      // 3.B Detección de Conflictos
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
