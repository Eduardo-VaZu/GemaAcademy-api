import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../shared/utils/error.util.js';

// Crear registro de recuperacion pendiente en caso sea marcado como FALTA.
const registrarFaltaPendiente = async (tx, alumnoId, fechaFalta) => {

  const cantidadInscripciones = await tx.inscripciones.count({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'ACTIVO',
    },
  });

  // Si tiene menos de 2 inscripciones, entonces no se crea una recuperacion pendiente.
  if (cantidadInscripciones < 2) {
    return null; // Retornamos null para indicar que no se creó nada.
  }
  // 1. Evitar duplicados
  const yaExiste = await tx.recuperaciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      fecha_falta: new Date(fechaFalta),
      estado: 'PENDIENTE',
    },
  });

  if (yaExiste) {
    return yaExiste;
  }

  // Obtenemos su inscripción para calcular su ciclo
  const inscripcion = await tx.inscripciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'ACTIVO',
    },
    orderBy: {
      fecha_inscripcion: 'asc',
    },
  });

  if (inscripcion) {
    const inicioInscripcion = new Date(inscripcion.fecha_inscripcion);
    const fechaFaltaDate = new Date(fechaFalta);

    const diffFalta = fechaFaltaDate - inicioInscripcion;
    const diasTranscurridosFalta = Math.floor(diffFalta / (1000 * 60 * 60 * 24));

    if (diasTranscurridosFalta >= 0) {
      const numeroBloqueFalta = Math.floor(diasTranscurridosFalta / 30);

      const inicioCicloFalta = new Date(inicioInscripcion);
      inicioCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + numeroBloqueFalta * 30);

      const finCicloFalta = new Date(inicioInscripcion);
      finCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + (numeroBloqueFalta + 1) * 30);

      const ticketsEnCiclo = await tx.recuperaciones.count({
        where: {
          alumno_id: Number.parseInt(alumnoId),
          es_por_lesion: false, // No contamos los tickets VIP
          fecha_falta: {
            gte: inicioCicloFalta,
            lt: finCicloFalta,
          }
        },
      });

      // Definir su límite según su plan
      const limitePermitido = cantidadInscripciones >= 4 ? 4 : 2;

      // Si ya llegó al tope, abortamos la creación del ticket
      if (ticketsEnCiclo >= limitePermitido) {
        console.log(`El alumno ${alumnoId} alcanzó su límite de ${limitePermitido} faltas normales para su ciclo actual.`);
        return null;
      }
    }
  }

  // 3. Crear el registro pendiente si pasa validación de límite
  const nuevaFalta = await tx.recuperaciones.create({
    data: {
      alumno_id: Number.parseInt(alumnoId),
      fecha_falta: new Date(fechaFalta),
      estado: 'PENDIENTE',
    },
  });

  return nuevaFalta;
};

// Función para manejar el estado FALTA/PRESENTE en marcar asistencia y eliminar el registro creado en recuperaciones.
const anularFaltaPendiente = async (tx, alumnoId, fechaFalta) => {
  await tx.recuperaciones.deleteMany({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      fecha_falta: new Date(fechaFalta),
      estado: 'PENDIENTE',
      es_por_lesion: false
    }
  });
};

// Permite al alumno poder cancelar una recuperación agendada con 12 horas de anticipación.
const cancelarRecuperacion = async (alumnoId, recuperacionId) => {
  // 1. Buscamos el ticket y traemos la información del horario para saber a qué hora era la clase
  const ticket = await prisma.recuperaciones.findUnique({
    where: {
      id: Number.parseInt(recuperacionId)
    },
    include: {
      horarios_clases: true
    }
  });

  // 2. Validaciones
  if (!ticket) {
    throw new ApiError('El ticket de recuperación no existe.', 404);
  }

  if (ticket.alumno_id !== Number.parseInt(alumnoId)) {
    throw new ApiError('No tienes permiso para cancelar esta recuperación.', 403);
  }

  if (ticket.estado !== 'PROGRAMADA') {
    throw new ApiError('Solo puedes cancelar recuperaciones que estén programadas.', 400);
  }

  // 3. Lógica del Reloj (Validación de 12 horas)
  const ahora = new Date();

  // Armamos la fecha y hora exacta de la clase
  const fechaClase = new Date(ticket.fecha_programada);
  const horaInicio = new Date(ticket.horarios_clases.hora_inicio);

  fechaClase.setHours(horaInicio.getHours(), horaInicio.getMinutes(), 0, 0);

  // Calculamos la diferencia en milisegundos y la pasamos a horas
  const diferenciaMilisegundos = fechaClase.getTime() - ahora.getTime();
  const horasFaltantes = diferenciaMilisegundos / (1000 * 60 * 60);

  // Si faltan menos de 12 horas o ya pasó la clase, no se puede cancelar.
  if (horasFaltantes < 12) {
    throw new ApiError(
      'Ya no puedes cancelar esta clase. Debes hacerlo con al menos 12 horas de anticipación.',
      400
    );
  }

  // 4. Devolvemos el ticket cancelado con estado PENDIENTE y sin programar.
  const ticketCancelado = await prisma.recuperaciones.update({
    where: {
      id: ticket.id
    },
    data: {
      estado: 'PENDIENTE',
      horario_destino_id: null,
      fecha_programada: null
    }
  });

  return ticketCancelado;
};

const obtenerHistorial = async (alumnoId) => {
  const historial = await prisma.recuperaciones.findMany({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: { in: ['PROGRAMADA', 'COMPLETADA', 'CANCELADA', 'VENCIDA', 'COMPLETADA_FALTA', 'COMPLETADA_PRESENTE'] },
    },
    include: {
      horarios_clases: {
        include: {
          canchas: {
            include: { sedes: true }
          }
        }
      }
    },
    orderBy: {
      fecha_falta: 'desc',
    },
  });

  return historial;
}

const obtenerPendientes = async (alumnoId) => {
  const pendientes = await prisma.recuperaciones.findMany({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'PENDIENTE',
    },
    orderBy: {
      fecha_falta: 'asc', // Las más antiguas primero para que las recupere pronto
    },
  });

  const inscripcion = await prisma.inscripciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'ACTIVO',
    },
    orderBy: {
      fecha_inscripcion: 'asc',
    },
  });

  // Si no hay inscripción activa, devolvemos los tickets tal cual
  if (!inscripcion) {
    return pendientes.map(p => ({ ...p, fecha_caducidad: null }));
  }

  const inicioInscripcion = new Date(inscripcion.fecha_inscripcion);

  // Inyectamos en cada ticket sin lesión la fecha límite
  const pendientesConFechaLimite = pendientes.map((ticket) => {

    if (ticket.es_por_lesion) {
      return {
        ...ticket,
        fecha_caducidad: null
      };
    }

    const fechaFaltaDate = new Date(ticket.fecha_falta);

    const diffFalta = fechaFaltaDate - inicioInscripcion;
    const diasTranscurridosFalta = Math.floor(diffFalta / (1000 * 60 * 60 * 24));

    // Protección por si la fecha de falta es anterior a la inscripción (Para casos aislados de migración)
    if (diasTranscurridosFalta < 0) {
      return { ...ticket, fecha_caducidad: null };
    }

    const numeroBloqueFalta = Math.floor(diasTranscurridosFalta / 30);

    const finCicloFalta = new Date(inicioInscripcion);
    finCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + (numeroBloqueFalta + 1) * 30);

    const fechaLimiteValida = new Date(finCicloFalta);
    fechaLimiteValida.setUTCDate(finCicloFalta.getUTCDate() + 30);

    return {
      ...ticket,
      fecha_caducidad: fechaLimiteValida
    };
  });

  return pendientesConFechaLimite;
};

/**
 * Valida TODAS las reglas de negocio antes de permitir una recuperación.
 */
const validarElegibilidad = async (alumnoId, fechaFalta, fechaProgramada) => {
  const fechaFaltaDate = new Date(fechaFalta);
  const fechaProgramadaDate = new Date(fechaProgramada);

  const faltaPendiente = await prisma.recuperaciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      fecha_falta: fechaFaltaDate,
      estado: 'PENDIENTE',
    },
  });

  if (!faltaPendiente) {
    throw new ApiError(
      'No se encontró una falta pendiente para esta fecha. Puede que ya haya sido recuperada o no se haya registrado la inasistencia aún.',
      404
    );
  }

  if (faltaPendiente.es_por_lesion) {

    const inscripcionActiva = await prisma.inscripciones.findFirst({
      where: { alumno_id: parseInt(alumnoId), estado: 'ACTIVO' }
    });

    if (!inscripcionActiva) {
      throw new ApiError('Debes tener una inscripción activa para agendar.', 403);
    }

    if (fechaProgramadaDate < new Date()) {
      throw new ApiError('La fecha programada debe ser futura.', 400);
    }

    return true;
  }

  const inscripcion = await prisma.inscripciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'ACTIVO',
    },
    orderBy: {
      fecha_inscripcion: 'asc',
    },
  });

  if (!inscripcion) {
    throw new ApiError('No tienes una inscripción activa.', 403);
  }

  const inicioInscripcion = new Date(inscripcion.fecha_inscripcion);

  // ---------------------------------------------------------
  // 1. VALIDACIÓN DE PLAN (Mínimo 2 veces por semana)
  // ---------------------------------------------------------
  const cantidadClasesInscritas = await prisma.inscripciones.count({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      estado: 'ACTIVO',
    },
  });

  if (cantidadClasesInscritas < 2) {
    throw new ApiError('Tu plan actual no incluye el beneficio de recuperaciones.', 403);
  }

  // ---------------------------------------------------------
  // 2. CÁLCULO DEL CICLO DE LA FALTA
  // ---------------------------------------------------------

  // Calculamos a qué ciclo pertenece la falta
  const diffFalta = fechaFaltaDate - inicioInscripcion;
  const diasTranscurridosFalta = Math.floor(diffFalta / (1000 * 60 * 60 * 24));

  if (diasTranscurridosFalta < 0) {
    throw new ApiError('La fecha de la falta es anterior a tu inscripción.', 400);
  }

  const numeroBloqueFalta = Math.floor(diasTranscurridosFalta / 30);

  // Inicio y Fin del ciclo donde ocurrió la falta
  const inicioCicloFalta = new Date(inicioInscripcion);
  inicioCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + numeroBloqueFalta * 30);

  const finCicloFalta = new Date(inicioInscripcion);
  finCicloFalta.setUTCDate(inicioInscripcion.getUTCDate() + (numeroBloqueFalta + 1) * 30);

  // ---------------------------------------------------------
  // 3. VALIDACIÓN DE VIGENCIA (Fin del ciclo de falta + 30 días)
  // ---------------------------------------------------------

  const fechaLimiteValida = new Date(finCicloFalta);
  fechaLimiteValida.setUTCDate(finCicloFalta.getUTCDate() + 30);

  if (fechaProgramadaDate > fechaLimiteValida) {
    throw new ApiError('La vigencia para recuperar esta falta ha expirado o sobrepasa la fecha límite.', 400);
  }

  // ---------------------------------------------------------
  // 4. VALIDACIÓN DE TOPE DE CUPOS
  // ---------------------------------------------------------
  const recuperacionesEnCiclo = await prisma.recuperaciones.count({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      es_por_lesion: false,
      fecha_falta: {
        gte: inicioCicloFalta,
        lt: finCicloFalta,
      },
      estado: { in: ['PROGRAMADA', 'COMPLETADA'] },
    },
  });

  let limitePermitido = 2;
  if (cantidadClasesInscritas >= 4) {
    limitePermitido = 4;
  }

  if (recuperacionesEnCiclo >= limitePermitido) {
    throw new ApiError(`Has alcanzado tu límite de ${limitePermitido} recuperaciones.`, 400);
  }

  return true;
};

/**
 * Crea el registro de recuperación tras pasar validaciones y chequear aforo.
 */
const agendarRecuperacion = async ({ alumnoId, fechaFalta, horarioDestinoId, fechaProgramada }) => {
  // 1. Re-validar reglas de negocio (Doble check de seguridad)
  await validarElegibilidad(alumnoId, fechaFalta, fechaProgramada);

  // 2. VALIDACIÓN DE AFORO
  // Necesitamos saber si cabe un alumno más en esa clase específica
  const horarioDestino = await prisma.horarios_clases.findUnique({
    where: { id: Number.parseInt(horarioDestinoId) },
  });

  if (!horarioDestino) {
    throw new ApiError('El horario seleccionado no existe.', 404);
  }

  // A. Contar inscritos fijos en ese horario
  const inscritosFijos = await prisma.inscripciones.count({
    where: {
      horario_id: Number.parseInt(horarioDestinoId),
      estado: 'ACTIVO',
    },
  });

  // B. Contar recuperaciones agendadas para ESA fecha específica
  const recuperacionesEseDia = await prisma.recuperaciones.count({
    where: {
      horario_destino_id: Number.parseInt(horarioDestinoId),
      fecha_programada: new Date(fechaProgramada),
      estado: { not: 'PENDIENTE' }, //Podría ser un estado 'CANCELADO'
    },
  });

  const ocupacionTotal = inscritosFijos + recuperacionesEseDia;

  if (ocupacionTotal >= horarioDestino.capacidad_max) {
    throw new ApiError(
      'Lo sentimos, este horario ya no tiene cupos disponibles para la fecha seleccionada.',
      409
    );
  }

  // 3. RECUPERAR EL ID DEL REGISTRO PENDIENTE
  const faltaPendiente = await prisma.recuperaciones.findFirst({
    where: {
      alumno_id: Number.parseInt(alumnoId),
      fecha_falta: new Date(fechaFalta),
      estado: 'PENDIENTE',
    },
  });

  if (!faltaPendiente) {
    throw new ApiError('El registro de falta pendiente no se pudo encontrar para actualizar.', 404);
  }

  // 4. ACTUALIZAR (UPDATE) EL REGISTRO EXISTENTE
  const recuperacionActualizada = await prisma.recuperaciones.update({
    where: {
      id: faltaPendiente.id, // Usamos el ID que acabamos de encontrar
    },
    data: {
      horario_destino_id: Number.parseInt(horarioDestinoId),
      fecha_programada: new Date(fechaProgramada),
      estado: 'PROGRAMADA',
    },
  });

  return recuperacionActualizada;
};

// Exportamos el objeto con las funciones
export const recuperacionService = {
  obtenerPendientes,
  validarElegibilidad,
  agendarRecuperacion,
  registrarFaltaPendiente,
  anularFaltaPendiente,
  cancelarRecuperacion,
  obtenerHistorial,
};
