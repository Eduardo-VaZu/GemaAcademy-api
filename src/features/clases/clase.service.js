import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

export const claseService = {
  reprogramarMasivamente: async ({
    horario_origen_id,
    fecha_origen,
    horario_destino_id,
    fecha_destino,
    motivo,
    usuario_admin_id,
  }) => {
    // 1. Validar IDs y Fechas
    const [horarioOrigen, horarioDestino] = await Promise.all([
      prisma.horarios_clases.findUnique({ where: { id: horario_origen_id } }),
      prisma.horarios_clases.findUnique({ where: { id: horario_destino_id } }),
    ]);

    if (!horarioOrigen) throw new ApiError('Horario de origen no encontrado', 404);
    if (!horarioDestino) throw new ApiError('Horario de destino no encontrado', 404);

    const fechaOrigenDate = new Date(fecha_origen);
    // Ajustar a mediodía para evitar problemas de timezone
    fechaOrigenDate.setHours(12, 0, 0, 0);

    const fechaDestinoDate = new Date(fecha_destino);
    fechaDestinoDate.setHours(12, 0, 0, 0);

    // Validar día de la semana (0=Domingo, 1=Lunes...)
    // En BD: 1=Lunes, 7=Domingo.
    // getDay(): 0=Domingo, 1=Lunes.
    // Ajuste: getDay() === 0 ? 7 : getDay()
    const diaOrigen = fechaOrigenDate.getDay() === 0 ? 7 : fechaOrigenDate.getDay();
    const diaDestino = fechaDestinoDate.getDay() === 0 ? 7 : fechaDestinoDate.getDay();

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

    // 2. Obtener Alumnos Afectados (Inscripciones Activas)
    const inscripciones = await prisma.inscripciones.findMany({
      where: {
        horario_id: horario_origen_id,
        estado: 'ACTIVO',
      },
      include: {
        alumnos: true, // Para tener el alumno_id
      },
    });

    if (inscripciones.length === 0) {
      throw new ApiError('No hay alumnos inscritos en el horario de origen para reprogramar', 404);
    }

    // 3. Validar Capacidad Destino (Opcional - Check simple)
    // Contar ocupación actual en destino para esa fecha
    const inscritosDestino = await prisma.inscripciones.count({
      where: { horario_id: horario_destino_id, estado: 'ACTIVO' },
    });
    const recuperacionesDestino = await prisma.recuperaciones.count({
      where: {
        horario_destino_id: horario_destino_id,
        fecha_programada: fechaDestinoDate,
        estado: { not: 'PENDIENTE' },
      },
    });

    const ocupacionActual = inscritosDestino + recuperacionesDestino;
    const cuposNecesarios = inscripciones.length;
    // NOTA: Se permite overbooking si es administrador, pero registramos la advertencia o bloqueamos si se desea estricto.
    // Por ahora procedemos, asumiendo que el admin sabe lo que hace, pero la lógica de conflictos individual filtrará.

    // 4. Transacción de Reprogramación
    const resultado = await prisma.$transaction(async (tx) => {
      let procesados = 0;
      let exitosos = 0;
      let conflictos = 0;
      const detalleConflictos = [];

      for (const inscripcion of inscripciones) {
        procesados++;
        const alumnoId = inscripcion.alumno_id;

        // A. Registrar Suspensión (Historial)
        // Verificar si ya existe registro para no duplicar (idempotencia)
        const asistenciaExistente = await tx.registros_asistencia.findUnique({
          where: {
            inscripcion_id_fecha: {
              inscripcion_id: inscripcion.id,
              fecha: fechaOrigenDate,
            },
          },
        });

        if (!asistenciaExistente) {
          await tx.registros_asistencia.create({
            data: {
              inscripcion_id: inscripcion.id,
              fecha: fechaOrigenDate,
              estado: 'SUSPENDIDO',
              comentario: `Reprogramado masivamente por: ${motivo}. Admin: ${usuario_admin_id}`,
              registrado_por: usuario_admin_id,
            },
          });
        } else {
          // Actualizar si ya existía (ej: estaba como 'PROGRAMADA')
          await tx.registros_asistencia.update({
            where: { id: asistenciaExistente.id },
            data: {
              estado: 'SUSPENDIDO',
              comentario: `Reprogramado masivamente por: ${motivo}. Admin: ${usuario_admin_id}`,
            },
          });
        }

        // B. Chequeo de Conflicto en Destino
        // 1. ¿Está inscrito en el horario destino?
        const yaInscrito = await tx.inscripciones.findFirst({
          where: {
            alumno_id: alumnoId,
            horario_id: horario_destino_id,
            estado: 'ACTIVO',
          },
        });

        // 2. ¿Tiene otra recuperación programada en ese horario/fecha?
        const yaRecuperando = await tx.recuperaciones.findFirst({
          where: {
            alumno_id: alumnoId,
            horario_destino_id: horario_destino_id,
            fecha_programada: fechaDestinoDate,
            estado: 'PROGRAMADA',
          },
        });

        // 3. (Opcional) Chequeo de solapamiento horario con otras clases
        // Para V1 simplificado: Si ya tiene clase en el mismo slot exacto.
        // Podríamos buscar cualquier asistencia en esa fecha y ver si las horas chocan.
        // Por ahora nos limitamos a "Mismo Horario ID" o "Ya tiene algo agendado ahí".

        if (yaInscrito || yaRecuperando) {
          conflictos++;
          detalleConflictos.push({
            alumno_id: alumnoId,
            razon: yaInscrito
              ? 'Ya está inscrito en el horario destino'
              : 'Ya tiene una recuperación programada ahí',
          });

          // C. Crear Recuperación PENDIENTE (Conflicto)
          await tx.recuperaciones.create({
            data: {
              alumno_id: alumnoId,
              fecha_falta: fechaOrigenDate,
              motivo_falta: `INSTITUCIONAL: ${motivo} (Conflicto al reprogramar)`,
              estado: 'PENDIENTE',
              es_por_lesion: false,
              // No asignamos destino ni fecha programada
            },
          });
        } else {
          exitosos++;
          // C. Crear Recuperación PROGRAMADA (Éxito)
          await tx.recuperaciones.create({
            data: {
              alumno_id: alumnoId,
              fecha_falta: fechaOrigenDate,
              motivo_falta: `INSTITUCIONAL: ${motivo}`,
              estado: 'PROGRAMADA',
              es_por_lesion: false,
              horario_destino_id: horario_destino_id,
              fecha_programada: fechaDestinoDate,
            },
          });
        }
      }

      return {
        total_procesados: procesados,
        reprogramados_exitosamente: exitosos,
        pendientes_por_conflicto: conflictos,
        detalle_conflictos: detalleConflictos,
      };
    });

    return resultado;
  },
};
