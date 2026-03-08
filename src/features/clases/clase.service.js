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
    horaInicioDestinoStr,
    horaFinDestinoStr,
  } = params;

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
      niveles_entrenamiento: { select: { nombre: true } }
    }
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
        throw new ApiError(`No puedes mover la clase a este horario porque coincide con la clase regular normal de este mismo grupo programada para ese día.`, 400);
      }
      throw new ApiError(`La cancha seleccionada está ocupada en ese horario por la clase de nivel ${hc.niveles_entrenamiento.nombre} (${hc.hora_inicio.toISOString().substring(11, 16)} - ${hc.hora_fin.toISOString().substring(11, 16)}).`, 400);
    }
  }

  // Comprobar colisiones con otras reprogramaciones masivas ese mismo día
  const overridesEnCancha = await prisma.reprogramaciones_clases.findMany({
    where: {
      fecha_destino: fechaDestinoDate,
      horarios_clases: { cancha_id: horarioOrigen.cancha_id }
    },
    select: { id: true, hora_inicio_destino: true, hora_fin_destino: true, horario_id: true }
  });

  for (const override of overridesEnCancha) {
    if (override.horario_id === origenId) continue;

    const [hI, mI] = override.hora_inicio_destino.split(':').map(Number);
    const [hF, mF] = override.hora_fin_destino.split(':').map(Number);
    const st = hI * 60 + mI;
    const en = hF * 60 + mF;
    if (inicioMinutos < en && finMinutos > st) {
      throw new ApiError(`La cancha ya fue reservada para otra clase reprogramada en ese rango horario (${override.hora_inicio_destino} - ${override.hora_fin_destino}).`, 400);
    }
  }

  // 6. Validar si los alumnos del horario origen tienen ya una clase programada ese día en OTRO nivel/horario
  // Obtenemos los alumnos del horario
  const inscripcionesOrigen = await prisma.inscripciones.findMany({
    where: { horario_id: origenId, estado: 'ACTIVO' },
    select: { id: true, alumno_id: true }
  });

  const alumnoIds = inscripcionesOrigen.map(i => i.alumno_id);

  // Verificamos si tienen asistencias para el DESTINO
  const posiblesInterferencias = await prisma.registros_asistencia.findMany({
    where: {
      fecha: fechaDestinoDate,
      inscripciones: {
        alumno_id: { in: alumnoIds },
        estado: 'ACTIVO' // Clases activas ese día nuevo
      }
    },
    include: {
      reprogramaciones_clases: true,
      inscripciones: {
        include: { 
          alumnos: { include: { usuarios: { select: { nombres: true, apellidos: true } } } },
          horarios_clases: { select: { hora_inicio: true, hora_fin: true } }
        }
      }
    }
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
         nombresConflictivos.add(`${int.inscripciones.alumnos.usuarios.nombres} ${int.inscripciones.alumnos.usuarios.apellidos}`);
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
      inscripciones: { horario_id: origenId }
    }
  });

  if (registrosOrigen === 0) {
    throw new ApiError(`No hay registros de asistencia (clases programadas) para la fecha origen (${fechaOrigenStr}) en este horario. Revisa si el mes ya fue generado.`, 400);
  }

  return { fechaOrigenDate, fechaDestinoDate, horaInicioFinal, horaFinFinal, inscripciones: inscripcionesOrigen };
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
    fecha_destino,
    hora_inicio_destino,
    hora_fin_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Validaciones y Obtención de Afectados
    const { fechaOrigenDate, fechaDestinoDate, horaInicioFinal, horaFinFinal, inscripciones } = await validarFechasYHorarios({
      origenId: horario_origen_id,
      fechaOrigenStr: fecha_origen,
      fechaDestinoStr: fecha_destino,
      horaInicioDestinoStr: hora_inicio_destino,
      horaFinDestinoStr: hora_fin_destino,
    });

    const dateOrigenStr = fechaOrigenDate.toLocaleDateString();
    const dateDestinoStr = fechaDestinoDate.toLocaleDateString();

    // 3. Ejecución Transaccional Batch
    return await prisma.$transaction(async (tx) => {
      // A) Crear el registro de la reprogramación
      const reprogramacion = await tx.reprogramaciones_clases.create({
        data: {
          horario_id: horario_origen_id,
          fecha_origen: fechaOrigenDate,
          fecha_destino: fechaDestinoDate,
          hora_inicio_destino: horaInicioFinal,
          hora_fin_destino: horaFinFinal,
          motivo: motivo,
          creado_por: usuario_admin_id,
        }
      });

      let procesados = 0;
      const nuevasClases = [];
      const alertas = [];

      for (const inscripcion of inscripciones) {
        // B) Preparar el espacio temporal esperado de asistencia en el nuevo día
        nuevasClases.push({
          inscripcion_id: inscripcion.id,
          fecha: fechaDestinoDate,
          estado: 'PENDIENTE',
          reprogramacion_clase_id: reprogramacion.id,
          comentario: `Reprogramación masiva desde (${dateOrigenStr}) por ${motivo}`,
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

      // 4. Inserciones masivas
      const inscripcionIds = inscripciones.map((i) => i.id);

      // Actualizamos el estado de la clase original a REPROGRAMADO
      await tx.registros_asistencia.updateMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaOrigenDate,
        },
        data: {
          estado: 'REPROGRAMADO',
          comentario: `Reprogramación masiva hacia ${fecha_destino}: ${motivo}`
        }
      });

      // Limpiamos los "fantasmas" previos
      await tx.registros_asistencia.deleteMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaDestinoDate,
          estado: 'PENDIENTE'
        }
      });

      // Insertamos el nuevo registro que aparecerá en el destino
      await tx.registros_asistencia.createMany({
        data: nuevasClases,
        skipDuplicates: true
      });

      // Activamos notificaciones
      await tx.notificaciones.createMany({
        data: alertas,
      });

      return {
        total_procesados: procesados,
        reprogramacion_id: reprogramacion.id,
        mensaje: 'Reprogramación masiva ejecutada exitosamente.',
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

  /**
   * Obtiene las fechas únicas disponibles (ya generadas en registros_asistencia) para un horario específico,
   * excluyendo aquellas fechas que ya hayan sido reprogramadas masivamente.
   */
  obtenerFechasDisponibles: async (horario_id) => {
    // Buscamos todos los registros asociados a las inscripciones de este horario
    const registros = await prisma.registros_asistencia.findMany({
      where: {
        inscripciones: {
          horario_id: Number(horario_id),
          estado: 'ACTIVO'
        },
        estado: {
          not: 'REPROGRAMADO' // No mostrar fechas ya reprogramadas
        }
      },
      select: {
        fecha: true
      },
      distinct: ['fecha'], // Obtener fechas únicas
      orderBy: {
        fecha: 'asc'
      }
    });

    // Mapeamos a un formato string normalizado YYYY-MM-DD
    return registros.map(r => r.fecha.toISOString().substring(0, 10));
  },
};
