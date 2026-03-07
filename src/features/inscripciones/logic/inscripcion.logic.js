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
export const calcularCicloUpgrade = async (tx, alumnoId) => {
  const hoy = new Date();
  
  // 1. Buscamos la Fecha Madre
  const inscripcionMadre = await tx.inscripciones.findFirst({
    where: { alumno_id: parseInt(alumnoId), estado: 'ACTIVO' },
    orderBy: { fecha_inscripcion: 'asc' }, 
  });

  if (inscripcionMadre) {
    const fechaInicioCiclo = new Date(inscripcionMadre.fecha_inscripcion);
    
    // =================================================================
    // 🔥 NUEVO BLOQUEO CASO 9: EL AGUJERO NEGRO DEL PAGADOR ANTICIPADO
    // =================================================================
    if (fechaInicioCiclo > hoy) {
      throw new Error(
        `⛔ CIERRE DE CICLO: Ya adelantaste el pago de tu próximo mes. Espera al inicio de tu nuevo ciclo para agregar más horarios.`
      );
    }
    // =================================================================

    // 2. Si pasa la validación, calculamos el fin de su mes normal
    const fechaFinCiclo = new Date(fechaInicioCiclo);
    fechaFinCiclo.setDate(fechaFinCiclo.getDate() + 30);

    return fechaFinCiclo > hoy ? fechaFinCiclo : null;
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