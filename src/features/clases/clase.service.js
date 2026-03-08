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

  // 4. Validaciones de Cupo (No pasarse del salón de 20 pax genérico para reprogramaciones)
  const CAPACIDAD_DEFAULT = 20;
  const cantidadAlumnosAMover = horarioOrigen._count.inscripciones;

  if (CAPACIDAD_DEFAULT < cantidadAlumnosAMover) {
    throw new ApiError(
      `Sobrecupo: Intentas mover ${cantidadAlumnosAMover} alumno(s), pero el límite institucional por sesión es de ${CAPACIDAD_DEFAULT}. Por favor divide el grupo.`,
      400
    );
  }

  // 2. Validaciones de Viaje en el Tiempo (Integridad de la BD Audit)
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
    const dateOrigenStr = fechaOrigenDate.toLocaleDateString();
    const dateDestinoStr = fechaDestinoDate.toLocaleDateString();

    // 3. Ejecución Transaccional Batch
    return await prisma.$transaction(async (tx) => {
      let procesados = 0;

      const anulaciones = [];
      const nuevasClases = [];
      const alertas = [];

      // A) Creación del Horario Efímero (Soft-Deletable)
      const baseDate = '1970-01-01T';
      const horarioTemporal = await tx.horarios_clases.create({
        data: {
          cancha_id,
          coordinador_id: coordinador_id || null,
          nivel_id,
          dia_semana: diaDestino,
          hora_inicio: new Date(`${baseDate}${hora_inicio}Z`),
          hora_fin: new Date(`${baseDate}${hora_fin}Z`),
          capacidad_max: 20,
          activo: true, // Quedará vivo hasta que pase el día y el Cronjob lo apague
          minutos_reserva_especifico: null,
        },
      });
      const horario_destino_id = horarioTemporal.id;

      for (const inscripcion of inscripciones) {
        // A) Anular la clase original para que el profe no los marque ausentes
        anulaciones.push({
          inscripcion_id: inscripcion.id,
          fecha: fechaOrigenDate,
          estado: 'REPROGRAMADO', // Nuevo estado lógico indicado por el usuario
          comentario: `Reprogramado por admin: ${motivo}`,
          registrado_por: usuario_admin_id,
        });

        // B) Crear la matrícula temporal atada al Horario Efímero
        await tx.inscripciones.create({
          data: {
            alumno_id: inscripcion.alumno_id,
            horario_id: horario_destino_id,
            estado: 'RECUPERACION', // Estado lógico interno
          },
        });

        // C) Crear el espacio esperado de asistencia en ese nuevo Horario
        nuevasClases.push({
          inscripcion_id: inscripcion.id, // Se liga al original por tracking financiero
          fecha: fechaDestinoDate,
          estado: 'PENDIENTE',
          comentario: `Viene reprogramada del original (${dateOrigenStr}). Temp ID: ${horario_destino_id}`,
          registrado_por: usuario_admin_id,
        });

        // D) Notificar al alumno de que su clase cambió
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
      // Primero anulamos las originales (como esto puede correrse 2 veces, upsert o updateMany es más seguro)
      const inscripcionIds = inscripciones.map((i) => i.id);
      await tx.registros_asistencia.updateMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaOrigenDate,
        },
        data: {
          estado: 'REPROGRAMADO',
          comentario: `Reprogramado por admin: ${motivo}`,
        },
      });

      // Insertar por las dudas si no existían previas
      await tx.registros_asistencia.createMany({
        data: anulaciones,
        skipDuplicates: true,
      });

      // Insertamos el nuevo día
      await tx.registros_asistencia.createMany({
        data: nuevasClases,
        skipDuplicates: true,
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
