/**
 * Determina si el alumno es Legacy (antiguo) basándose en su último pago aprobado.
 */
export const detectarRegimenAlumno = async (tx, alumnoId) => {
  // 1. Buscamos al alumno directamente por su ID y sacamos solo su historial
  const alumno = await tx.alumnos.findUnique({
    where: { usuario_id: parseInt(alumnoId) },
    select: { historial: true },
  });

  // 2. Si no existe o su historial está vacío (null), por defecto es alumno NUEVO (false)
  if (!alumno || !alumno.historial) {
    return false;
  }

  // 3. Verificamos si en su historial dice "Antiguo". 
  // Lo pasamos a mayúsculas para que no falle si el admin escribe "antiguo", "Antiguo" o "ANTIGUO".
  const esLegacy = alumno.historial.toUpperCase().includes('ANTIGUO');

  return esLegacy;
};

/**
 * Determina si es un Upgrade y calcula la fecha de corte del ciclo actual.
 */
/**
 * Determina si es un Upgrade y calcula la fecha de corte del ciclo actual.
 */
/**
 * Determina si es un Upgrade y calcula la fecha de corte del ciclo actual.
 */
export const calcularCicloUpgrade = async (tx, alumnoId) => {
  const hoyRaw = new Date();
  // 🔥 Limpiamos la hora de "hoy" para que sea exactamente la medianoche UTC
  const hoy = new Date(Date.UTC(hoyRaw.getUTCFullYear(), hoyRaw.getUTCMonth(), hoyRaw.getUTCDate()));
  
  const inscripcionMadre = await tx.inscripciones.findFirst({
    where: { alumno_id: parseInt(alumnoId), estado: 'ACTIVO' },
    orderBy: { fecha_inscripcion: 'asc' }, 
  });

  if (inscripcionMadre) {
    const fechaInicioCiclo = new Date(inscripcionMadre.fecha_inscripcion);
    const fechaFinCiclo = new Date(fechaInicioCiclo);
    fechaFinCiclo.setDate(fechaFinCiclo.getDate() + 30);

    // 🔥 Limpiamos la hora del fin de ciclo
    const finLimpio = new Date(Date.UTC(fechaFinCiclo.getUTCFullYear(), fechaFinCiclo.getUTCMonth(), fechaFinCiclo.getUTCDate()));

    // 🔥 Ahora la resta es perfecta y en días enteros
    const diasParaFinCiclo = Math.round((finLimpio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diasParaFinCiclo > 45) {
      throw new Error(
        `⛔ CIERRE DE CICLO: Ya adelantaste el pago de tu próximo mes. Espera al inicio de tu nuevo ciclo para agregar más horarios.`
      );
    }

    if (fechaFinCiclo > hoyRaw) { // Usamos hoyRaw aquí para que devuelva el objeto
      return {
        fechaCorte: fechaFinCiclo,
        fechaMadre: fechaInicioCiclo
      };
    }
  }
  return null;
};
/**
 * Busca y valida el plan que el alumno tiene actualmente para heredarlo.
 */
export const obtenerPlanParaRenovar = async (tx, alumnoId) => {
  const ultimaDeuda = await tx.cuentas_por_cobrar.findFirst({
    where: { alumno_id: alumnoId },
    orderBy: { id: 'desc' },
    include: { catalogo_conceptos: true },
  });

  if (!ultimaDeuda || !ultimaDeuda.catalogo_conceptos) return null;

  const concepto = ultimaDeuda.catalogo_conceptos;
  
  // Si el plan fue desactivado por administración, no se hereda
  if (!concepto.activo) return null;

  return concepto;
};