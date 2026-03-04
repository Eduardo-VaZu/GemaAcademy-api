import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const claseService = {
  /**
   * Reprograma una clase completa para un grupo de alumnos.
   * Mueve la clase de una fecha/horario origen a una fecha/horario destino.
   * Maneja conflictos de horario y actualiza la asistencia masivamente.
   *
   * @example
   * // JSON de Entrada (Request Body):
   * {
   *   "horario_origen_id": 10,
   *   "fecha_origen": "2026-02-16",
   *   "horario_destino_id": 25,
   *   "fecha_destino": "2026-02-21",
   *   "motivo": "Mantenimiento de Cancha"
   * }
   *
   * @example
   * // JSON de Salida (Response Data):
   * {
   *   "total_procesados": 20,
   *   "reprogramados_exitosamente": 18,
   *   "pendientes_por_conflicto": 2,
   *   "detalle_conflictos": [
   *     { "alumno_id": 105, "razon": "Conflicto de horario (ya tiene clase o recuperación)" },
   *     { "alumno_id": 108, "razon": "Conflicto de horario (ya tiene clase o recuperación)" }
   *   ]
   * }
   */
  reprogramarMasivamente: async ({
    horario_origen_id,
    fecha_origen,
    horario_destino_id,
    fecha_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // =================================================================
    // 1. VALIDACIONES INICIALES (IDs y Coherencia de Fechas)
    // =================================================================
    const [horarioOrigen, horarioDestino] = await Promise.all([
      prisma.horarios_clases.findUnique({ where: { id: horario_origen_id } }),
      prisma.horarios_clases.findUnique({ where: { id: horario_destino_id } }),
    ]);

    if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);
    if (!horarioDestino) throw new ApiError('Horario de destino no encontrado', 404);

    // Normalizamos fechas a mediodía para evitar errores de zona horaria
    const fechaOrigenDate = new Date(fecha_origen);
    fechaOrigenDate.setHours(12, 0, 0, 0);

    const fechaDestinoDate = new Date(fecha_destino);
    fechaDestinoDate.setHours(12, 0, 0, 0);

    // Validamos que la fecha coincida con el día de la semana del horario
    // getDay(): 0=Domingo, 1=Lunes... BD: 1=Lunes... 7=Domingo
    // Convertimos la fecha UTC a día de la semana para comparar con BD
    const diaOrigen = fechaOrigenDate.getUTCDay() === 0 ? 7 : fechaOrigenDate.getUTCDay();
    const diaDestino = fechaDestinoDate.getUTCDay() === 0 ? 7 : fechaDestinoDate.getUTCDay();

    if (diaOrigen !== horarioOrigen.dia_semana) {
      throw new ApiError(
        `La fecha origen ${fecha_origen} no corresponde al día del horario origen (Día ${horarioOrigen.dia_semana})`,
        400
      );
    }

    if (diaDestino !== horarioDestino.dia_semana) {
      throw new ApiError(
        `La fecha destino ${fecha_destino} no corresponde al día del horario destino (Día ${horarioDestino.dia_semana})`,
        400
      );
    }

    // =================================================================
    // 2. OBTENCIÓN DE ALUMNOS AFECTADOS
    // =================================================================
    const inscripciones = await prisma.inscripciones.findMany({
      where: {
        horario_id: horario_origen_id,
        estado: 'ACTIVO',
      },
      select: {
        id: true,
        alumno_id: true,
      },
    });

    if (inscripciones.length === 0) {
      throw new ApiError('No hay alumnos inscritos en el horario de origen para reprogramar', 404);
    }

    const alumnoIds = inscripciones.map((i) => i.alumno_id);
    const inscripcionIds = inscripciones.map((i) => i.id);

    // =================================================================
    // 3. EJECUCIÓN TRANSACCIONAL (Batch Processing)
    // =================================================================
    const resultado = await prisma.$transaction(async (tx) => {
      // ---------------------------------------------------------------
      // A. DETECCIÓN DE CONFLICTOS EN LOTE (Batch Read)
      // ---------------------------------------------------------------
      // Verificamos si los alumnos ya tienen compromiso en el horario destino

      // 1. ¿Ya están inscritos formalmente en el horario destino?
      const conflictosInscripcion = await tx.inscripciones.findMany({
        where: {
          horario_id: horario_destino_id,
          estado: 'ACTIVO',
          alumno_id: { in: alumnoIds },
        },
        select: { alumno_id: true },
      });

      // 2. ¿Ya tienen otra recuperación programada para esa fecha/hora?
      const conflictosRecuperacion = await tx.recuperaciones.findMany({
        where: {
          horario_destino_id: horario_destino_id,
          fecha_programada: fechaDestinoDate,
          estado: 'PROGRAMADA',
          alumno_id: { in: alumnoIds },
        },
        select: { alumno_id: true },
      });

      // Creamos un Set para búsqueda rápida O(1)
      const idsConConflicto = new Set([
        ...conflictosInscripcion.map((i) => i.alumno_id),
        ...conflictosRecuperacion.map((r) => r.alumno_id),
      ]);

      // Clasificamos a los alumnos
      const paraProgramar = []; // Sin conflicto -> Se agenda directo
      const paraPendiente = []; // Con conflicto -> Se deja ticket abierto
      const detalleConflictos = [];

      for (const inscripcion of inscripciones) {
        if (idsConConflicto.has(inscripcion.alumno_id)) {
          paraPendiente.push({
            alumno_id: inscripcion.alumno_id,
            fecha_falta: fechaOrigenDate,
            motivo_falta: `INSTITUCIONAL: ${motivo} (Conflicto al reprogramar)`,
            estado: 'PENDIENTE', // Dejamos pendiente para que el alumno elija otro día
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
            estado: 'PROGRAMADA', // Agendamos automáticamente
            es_por_lesion: false,
            horario_destino_id: horario_destino_id,
            fecha_programada: fechaDestinoDate,
          });
        }
      }

      // ---------------------------------------------------------------
      // B. ACTUALIZACIÓN DE ASISTENCIA (Suspensión Masiva)
      // ---------------------------------------------------------------

      // 1. Actualizar registros que YA existían (ej: generados por cron)
      await tx.registros_asistencia.updateMany({
        where: {
          inscripcion_id: { in: inscripcionIds },
          fecha: fechaOrigenDate,
        },
        data: {
          estado: 'SUSPENDIDO',
          comentario: `Reprogramado masivamente por: ${motivo}. Admin: ${usuario_admin_id}`,
        },
      });

      // 2. Crear registros para los que NO existían (skipDuplicates evita error)
      const asistenciasParaCrear = inscripciones.map((ins) => ({
        inscripcion_id: ins.id,
        fecha: fechaOrigenDate,
        estado: 'SUSPENDIDO',
        comentario: `Reprogramado masivamente por: ${motivo}. Admin: ${usuario_admin_id}`,
        registrado_por: usuario_admin_id,
      }));

      await tx.registros_asistencia.createMany({
        data: asistenciasParaCrear,
        skipDuplicates: true,
      });

      // ---------------------------------------------------------------
      // C. CREACIÓN DE RECUPERACIONES (Batch Write)
      // ---------------------------------------------------------------
      if (paraProgramar.length > 0) {
        await tx.recuperaciones.createMany({
          data: paraProgramar,
        });
      }

      if (paraPendiente.length > 0) {
        await tx.recuperaciones.createMany({
          data: paraPendiente,
        });
      }

      return {
        total_procesados: inscripciones.length,
        reprogramados_exitosamente: paraProgramar.length,
        pendientes_por_conflicto: paraPendiente.length,
        detalle_conflictos: detalleConflictos,
      };
    });

    return resultado;
  },

  /**
   * Obtiene el detalle de una clase específica (horario)
   * Incluye fecha, hora, día, coordinador, nivel, cancha y alumnos inscritos.
   */
  obtenerDetalleClase: async (horario_id) => {
    const horario = await prisma.horarios_clases.findUnique({
      where: { id: Number(horario_id) },
      include: {
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
      coordinador: `${horario.coordinadores.usuarios.nombres} ${horario.coordinadores.usuarios.apellidos}`,
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
