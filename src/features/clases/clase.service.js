import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

const DIAS_SEMANA_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const formatFechaEs = (date) => {
  if (!date) return 'Sin fecha';
  const d = new Date(date);
  // Forzamos el uso de UTC para evitar que el offset de Lima (-5h) reste un día
  const options = { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' };
  let str = d.toLocaleDateString('es-ES', options);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

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
  const { origenId, fechaOrigenStr, fechaDestinoStr, horaInicioDestinoStr, horaFinDestinoStr } =
    params;

  // 1. Traer origen
  const horarioOrigen = await prisma.horarios_clases.findUnique({
    where: { id: origenId },
    select: {
      dia_semana: true,
      hora_inicio: true,
      hora_fin: true,
      cancha_id: true,
      _count: { select: { inscripciones: { where: { estado: 'ACTIVO' } } } },
    },
  });

  if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);

  // 3. Validaciones de Viaje en el Tiempo
  // 3. Validaciones de Viaje en el Tiempo (Basadas en UTC 12:00 para estabilidad)
  const hoyStr = new Date().toISOString().substring(0, 10);
  const hoyDate = new Date(hoyStr);
  hoyDate.setUTCHours(12, 0, 0, 0);

  const fechaOrigenDate = new Date(fechaOrigenStr);
  fechaOrigenDate.setUTCHours(12, 0, 0, 0);

  const fechaDestinoDate = new Date(fechaDestinoStr);
  fechaDestinoDate.setUTCHours(12, 0, 0, 0);

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

  // 4. Analizar Tiempos Requeridos (Defaults vs Overrides)
  let inicioMinutos, finMinutos;
  let horaInicioFinal, horaFinFinal;

  if (horaInicioDestinoStr && horaFinDestinoStr) {
    const [hI, mI] = horaInicioDestinoStr.split(':').map(Number);
    const [hF, mF] = horaFinDestinoStr.split(':').map(Number);
    inicioMinutos = hI * 60 + mI;
    finMinutos = hF * 60 + mF;
    horaInicioFinal = horaInicioDestinoStr;
    horaFinFinal = horaFinDestinoStr;
  } else {
    const hI = horarioOrigen.hora_inicio.getUTCHours();
    const mI = horarioOrigen.hora_inicio.getUTCMinutes();
    const hF = horarioOrigen.hora_fin.getUTCHours();
    const mF = horarioOrigen.hora_fin.getUTCMinutes();
    inicioMinutos = hI * 60 + mI;
    finMinutos = hF * 60 + mF;
    horaInicioFinal = `${String(hI).padStart(2, '0')}:${String(mI).padStart(2, '0')}`;
    horaFinFinal = `${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}`;
  }

  if (inicioMinutos >= finMinutos) {
    throw new ApiError('La hora de inicio seleccionada debe ser anterior a la hora de fin.', 400);
  }

  // 5. Validar Disponibilidad de Cancha
  const diaDestino = fechaDestinoDate.getUTCDay() === 0 ? 7 : fechaDestinoDate.getUTCDay();
  const diffTime = Math.abs(fechaDestinoDate - fechaOrigenDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const horariosCancha = await prisma.horarios_clases.findMany({
    where: {
      cancha_id: horarioOrigen.cancha_id,
      dia_semana: diaDestino,
      activo: true,
    },
    select: {
      id: true,
      hora_inicio: true,
      hora_fin: true,
      niveles_entrenamiento: { select: { nombre: true } },
    },
  });

  for (const hc of horariosCancha) {
    // Si estamos moviendo la clase dentro del MISMO día (solo cambiando la hora),
    // ignoramos el choque con la clase original (porque esa clase original se va a anular).
    // Pero si la movemos a OTRO día distinto que coincide con su día regular futuro,
    // DEBE lanzar error porque sobreescribiríamos la clase normal que los alumnos ya tienen.
    if (hc.id === origenId && diffDays === 0) continue;

    const startMins = hc.hora_inicio.getUTCHours() * 60 + hc.hora_inicio.getUTCMinutes();
    const endMins = hc.hora_fin.getUTCHours() * 60 + hc.hora_fin.getUTCMinutes();

    if (inicioMinutos < endMins && finMinutos > startMins) {
      if (hc.id === origenId) {
        throw new ApiError(
          `No puedes mover la clase a este horario porque coincide con la clase regular normal de este mismo grupo programada para ese día.`,
          400
        );
      }
      throw new ApiError(
        `La cancha seleccionada está ocupada en ese horario por la clase de nivel ${hc.niveles_entrenamiento.nombre} (${hc.hora_inicio.toISOString().substring(11, 16)} - ${hc.hora_fin.toISOString().substring(11, 16)}).`,
        400
      );
    }
  }

  // Comprobar colisiones con otras reprogramaciones masivas ese mismo día
  const overridesEnCancha = await prisma.reprogramaciones_clases.findMany({
    where: {
      fecha_destino: fechaDestinoDate,
      horarios_clases: { cancha_id: horarioOrigen.cancha_id },
    },
    select: { id: true, hora_inicio_destino: true, hora_fin_destino: true, horario_id: true },
  });

  for (const override of overridesEnCancha) {
    if (override.horario_id === origenId) continue;

    const [hI, mI] = override.hora_inicio_destino.split(':').map(Number);
    const [hF, mF] = override.hora_fin_destino.split(':').map(Number);
    const st = hI * 60 + mI;
    const en = hF * 60 + mF;
    if (inicioMinutos < en && finMinutos > st) {
      throw new ApiError(
        `La cancha ya fue reservada para otra clase reprogramada en ese rango horario (${override.hora_inicio_destino} - ${override.hora_fin_destino}).`,
        400
      );
    }
  }

  // 6. Validar si los alumnos del horario origen tienen ya una clase programada ese día en OTRO nivel/horario
  // Obtenemos los alumnos del horario
  const inscripcionesOrigen = await prisma.inscripciones.findMany({
    where: { horario_id: origenId, estado: 'ACTIVO' },
    select: { id: true, alumno_id: true },
  });

  const alumnoIds = inscripcionesOrigen.map((i) => i.alumno_id);

  // Verificamos si tienen asistencias para el DESTINO
  const posiblesInterferencias = await prisma.registros_asistencia.findMany({
    where: {
      fecha: fechaDestinoDate,
      inscripciones: {
        alumno_id: { in: alumnoIds },
        estado: 'ACTIVO', // Clases activas ese día nuevo
      },
    },
    include: {
      reprogramaciones_clases: true,
      inscripciones: {
        include: {
          alumnos: { include: { usuarios: { select: { nombres: true, apellidos: true } } } },
          horarios_clases: { select: { hora_inicio: true, hora_fin: true } },
        },
      },
    },
  });

  if (posiblesInterferencias.length > 0) {
    const nombresConflictivos = new Set();

    for (const int of posiblesInterferencias) {
      // 1. Extraer los tiempos de esta sesión interviniente
      let stInterferencia, enInterferencia;

      if (int.reprogramaciones_clases) {
        const [hI, mI] = int.reprogramaciones_clases.hora_inicio_destino.split(':').map(Number);
        const [hF, mF] = int.reprogramaciones_clases.hora_fin_destino.split(':').map(Number);
        stInterferencia = hI * 60 + mI;
        enInterferencia = hF * 60 + mF;
      } else {
        const hc = int.inscripciones.horarios_clases;
        stInterferencia = hc.hora_inicio.getUTCHours() * 60 + hc.hora_inicio.getUTCMinutes();
        enInterferencia = hc.hora_fin.getUTCHours() * 60 + hc.hora_fin.getUTCMinutes();
      }

      // 2. Comprobar si choca matemáticamente con la sesión propuesta
      if (inicioMinutos < enInterferencia && finMinutos > stInterferencia) {
        nombresConflictivos.add(
          `${int.inscripciones.alumnos.usuarios.nombres} ${int.inscripciones.alumnos.usuarios.apellidos}`
        );
      }
    }

    if (nombresConflictivos.size > 0) {
      throw new ApiError(
        `Cruce de horarios detectado para ciertos alumnos en la fecha destino (${fechaDestinoStr}) en el rango de ${horaInicioFinal}-${horaFinFinal}.`,
        400
      );
    }
  }

  // 6. Validar que existan registros a mover en la fecha ORIGEN
  const registrosOrigen = await prisma.registros_asistencia.count({
    where: {
      fecha: fechaOrigenDate,
      inscripciones: { horario_id: origenId },
    },
  });

  if (registrosOrigen === 0) {
    throw new ApiError(
      `No hay registros de asistencia (clases programadas) para la fecha origen (${fechaOrigenStr}) en este horario. Revisa si el mes ya fue generado.`,
      400
    );
  }

  return {
    fechaOrigenDate,
    fechaDestinoDate,
    horaInicioFinal,
    horaFinFinal,
    inscripciones: inscripcionesOrigen,
  };
};

// ELIMINADO: const obtenerAlumnosAfectados = async (horarioOrigenId) => ...
// La obtención de inscripciones ahora se hace dentro de validarFechasYHorarios para evitar doble query.

export const claseService = {
  /**
   * Reprograma una clase completa para un grupo de alumnos.
   * Modela una "Asistencia Anticipada" tal cual lo especificó la academia.
   */
  reprogramarMasivamente: async ({
    horario_origen_id,
    fecha_origen,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Obtener información básica del horario y afectados
    const horarioOrigen = await prisma.horarios_clases.findUnique({
      where: { id: horario_origen_id },
      select: {
        hora_inicio: true,
        hora_fin: true,
        cancha_id: true,
        inscripciones: {
          where: { estado: 'ACTIVO' },
          select: { id: true, alumno_id: true },
        },
      },
    });

    if (!horarioOrigen) throw new ApiError('Horario no encontrado', 404);
    const inscripciones = horarioOrigen.inscripciones;
    if (inscripciones.length === 0) throw new ApiError('No hay alumnos activos en este horario', 400);

    const fechaOrigenDate = new Date(fecha_origen);
    fechaOrigenDate.setUTCHours(12, 0, 0, 0);

    const dateOrigenStr = formatFechaEs(fechaOrigenDate);
    const importUUID = await import('crypto');
    const grupo_uuid = importUUID.randomUUID();

    return await prisma.$transaction(async (tx) => {
      const inscripcionIds = inscripciones.map(i => i.id);
      const alumnoIds = [...new Set(inscripciones.map(i => i.alumno_id))];

      // A) Obtener fecha de referencia para la cabecera (buscando la última clase de cualquiera de los afectados)
      const claseReferencia = await tx.registros_asistencia.findFirst({
        where: { inscripcion_id: { in: inscripcionIds } },
        orderBy: { fecha: 'desc' }
      });

      if (!claseReferencia) throw new ApiError('No se pudo determinar el final del cronograma', 400);

      const masterFechaDestino = new Date(claseReferencia.fecha);
      masterFechaDestino.setUTCDate(masterFechaDestino.getUTCDate() + 7);
      masterFechaDestino.setUTCHours(12, 0, 0, 0);

      // B) Crear cabecera única
      const reprogramacion = await tx.reprogramaciones_clases.create({
        data: {
          horario_id: horario_origen_id,
          fecha_origen: fechaOrigenDate,
          fecha_destino: masterFechaDestino,
          hora_inicio_destino:
            horarioOrigen.hora_inicio.getUTCHours().toString().padStart(2, '0') +
            ':' +
            horarioOrigen.hora_inicio.getUTCMinutes().toString().padStart(2, '0'),
          hora_fin_destino:
            horarioOrigen.hora_fin.getUTCHours().toString().padStart(2, '0') +
            ':' +
            horarioOrigen.hora_fin.getUTCMinutes().toString().padStart(2, '0'),
          motivo: motivo,
          creado_por: usuario_admin_id,
          es_masiva: true,
          estado: 'ACTIVO',
          grupo_uuid: grupo_uuid,
        },
      });

      // C) Marcar asistencias de origen como REPROGRAMADAS (Lote 1)
      await tx.registros_asistencia.updateMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaOrigenDate,
        },
        data: {
          estado: 'REPROGRAMADO',
          reprogramacion_clase_id: reprogramacion.id,
          comentario: `Reprogramada al final del ciclo por ${motivo}`,
        },
      });

      // D) Obtener la última fecha de CADA alumno para su reposición individual
      const ultimasClases = await tx.registros_asistencia.findMany({
        where: { inscripcion_id: { in: inscripcionIds } },
        orderBy: [{ inscripcion_id: 'asc' }, { fecha: 'desc' }],
        distinct: ['inscripcion_id']
      });

      // E) Crear las nuevas asistencias (Lote 2)
      const nuevasAsistencias = ultimasClases.map(u => {
        const fDestino = new Date(u.fecha);
        fDestino.setUTCDate(fDestino.getUTCDate() + 7);
        fDestino.setUTCHours(12, 0, 0, 0);
        return {
          inscripcion_id: u.inscripcion_id,
          fecha: fDestino,
          fecha_original: fechaOrigenDate,
          estado: 'PENDIENTE',
          reprogramacion_clase_id: reprogramacion.id,
          comentario: `Reposición de clase (${dateOrigenStr}) [NO_RECUPERABLE]. Motivo: ${motivo}`
        };
      });

      await tx.registros_asistencia.createMany({ data: nuevasAsistencias });

      // F) 🔥 EL MEJOR FIX: Mover fecha_inscripcion masivamente via SQL Directo
      // Esto soluciona definitivamente el error "Transaction already closed"
      await tx.$executeRaw`
        UPDATE inscripciones 
        SET fecha_inscripcion = fecha_inscripcion + INTERVAL '7 days'
        WHERE alumno_id = ANY(${alumnoIds})
        AND estado = 'ACTIVO'
      `;

      // G) Crear notificaciones (Lote 3)
      const alertas = alumnoIds.map(aId => ({
        alumno_id: aId,
        titulo: '🚨 Clase Reprogramada',
        mensaje: `Tu sesión del ${dateOrigenStr} ha sido movida al final de tu ciclo. Se extendió tu ciclo de facturación 7 días.`,
        tipo: 'ALERTA',
        categoria: 'CLASES',
      }));

      await tx.notificaciones.createMany({ data: alertas });

      return {
        total_procesados: inscripciones.length,
        reprogramacion_id: reprogramacion.id,
        grupo_uuid: grupo_uuid,
        mensaje: 'Reprogramación automática masiva ejecutada exitosamente.',
      };
    }, {
      timeout: 45000 // Aumentamos a 45s por si el executeRaw tarda en una tabla gigante
    });
  },

  /**
   * Revierte una reprogramación masiva previa utilizando el grupo_uuid
   */
  revertirReprogramacionMasiva: async (grupo_uuid) => {
    return await prisma.$transaction(async (tx) => {
      // 1. Buscar la reprogramación masiva
      const reprogramaciones = await tx.reprogramaciones_clases.findMany({
        where: { grupo_uuid: grupo_uuid, estado: 'ACTIVO' },
      });

      if (!reprogramaciones || reprogramaciones.length === 0) {
        throw new ApiError(
          'No se encontró una reprogramación masiva activa con ese identificador.',
          404
        );
      }

      const reprogramacionesIds = reprogramaciones.map((r) => r.id);

      // 2. Buscar todas las asistencias afectadas
      const asistencias = await tx.registros_asistencia.findMany({
        where: { reprogramacion_clase_id: { in: reprogramacionesIds } },
      });

      if (asistencias.length === 0) {
        throw new ApiError(
          'No se encontraron registros de asistencia asociados a esta reprogramación.',
          404
        );
      }

      // 3. Reversión de la asistencia
      // A) Borramos los registros "NUEVOS" creados en la fecha destino (los que tienen fecha_original)
      await tx.registros_asistencia.deleteMany({
        where: {
          reprogramacion_clase_id: { in: reprogramacionesIds },
          fecha_original: { not: null },
        },
      });

      // B) Restauramos los registros originales que estaban marcados como REPROGRAMADO
      await tx.registros_asistencia.updateMany({
        where: {
          reprogramacion_clase_id: { in: reprogramacionesIds },
          estado: 'REPROGRAMADO',
        },
        data: {
          estado: 'PENDIENTE',
          reprogramacion_clase_id: null,
          comentario: null,
          fecha_original: null,
        },
      });

      // 4. Marcar reprogramación como REVERTIDO
      await tx.reprogramaciones_clases.updateMany({
        where: { id: { in: reprogramacionesIds } },
        data: { estado: 'REVERTIDO' },
      });

      return { mensaje: 'Reprogramación revertida exitosamente.' };
    });
  },

  /**
   * Obtiene la lista de reprogramaciones masivas activas
   */
  obtenerMasivasActivas: async () => {
    const data = await prisma.reprogramaciones_clases.findMany({
      where: { es_masiva: true, estado: 'ACTIVO' },
      orderBy: { creado_en: 'desc' },
      include: {
        horarios_clases: {
          include: {
            canchas: { select: { nombre: true, sedes: { select: { nombre: true } } } },
            niveles_entrenamiento: { select: { nombre: true } },
          },
        },
        usuarios: { select: { nombres: true, apellidos: true } },
        _count: { select: { registros_asistencia: true } },
      },
    });

    // Dividimos entre 2 porque ahora guardamos el original (REPROGRAMADO) y el nuevo (PENDIENTE)
    return data.map((item) => ({
      ...item,
      _count: {
        ...item._count,
        registros_asistencia: Math.ceil(item._count.registros_asistencia / 2),
      },
    }));
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

  /**
   * Obtiene las fechas únicas disponibles (ya generadas en registros_asistencia) para un horario específico,
   * excluyendo aquellas fechas que ya hayan sido reprogramadas masivamente.
   */
  obtenerFechasDisponibles: async (horario_id) => {
    // Obtener la fecha de hoy en formato UTC para evitar desfases horarios nocturnos
    const hoyStr = new Date().toISOString().substring(0, 10);
    const hoy = new Date(hoyStr);

    // Buscamos todos los registros asociados a las inscripciones de este horario
    const registros = await prisma.registros_asistencia.findMany({
      where: {
        inscripciones: {
          horario_id: Number(horario_id),
          estado: 'ACTIVO',
        },
        estado: {
          not: 'REPROGRAMADO', // No mostrar fechas ya reprogramadas
        },
        fecha: {
          gte: hoy, // Solo fechas que no han pasado (hoy o futuro)
        },
      },
      select: {
        fecha: true,
      },
      distinct: ['fecha'], // Obtener fechas únicas
      orderBy: {
        fecha: 'asc',
      },
    });

    // Mapeamos a un formato string normalizado YYYY-MM-DD
    return registros.map((r) => r.fecha.toISOString().substring(0, 10));
  },

  /**
   * Obtiene la lista de horarios que tienen al menos un registro de asistencia generado,
   * para filtrar el selector de la reprogramación masiva.
   */
  obtenerHorariosConAsistencia: async () => {
    const horarios = await prisma.horarios_clases.findMany({
      where: {
        activo: true,
        inscripciones: {
          some: {
            estado: 'ACTIVO',
            registros_asistencia: {
              some: {
                estado: { not: 'REPROGRAMADO' },
              },
            },
          },
        },
      },
      select: {
        id: true,
        dia_semana: true,
        hora_inicio: true,
        hora_fin: true,
        canchas: {
          select: {
            nombre: true,
            sedes: { select: { nombre: true } },
          },
        },
        niveles_entrenamiento: { select: { nombre: true } },
      },
      orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    });

    return horarios.map((h) => ({
      id: h.id,
      dia_semana: h.dia_semana,
      hora_inicio:
        h.hora_inicio.getUTCHours().toString().padStart(2, '0') +
        ':' +
        h.hora_inicio.getUTCMinutes().toString().padStart(2, '0'),
      hora_fin:
        h.hora_fin.getUTCHours().toString().padStart(2, '0') +
        ':' +
        h.hora_fin.getUTCMinutes().toString().padStart(2, '0'),
      nivel: { nombre: h.niveles_entrenamiento.nombre },
      cancha: {
        nombre: h.canchas.nombre,
        sede: { nombre: h.canchas.sedes.nombre },
      },
    }));
  },
};
