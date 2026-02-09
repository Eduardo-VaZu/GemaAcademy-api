/**
 * Determina si el alumno es Legacy (antiguo) basándose en su último pago aprobado.
 */
export const detectarRegimenAlumno = async (tx, alumnoId) => {
  const ultimoPago = await tx.pagos.findFirst({
    where: {
      cuentas_por_cobrar: { alumno_id: parseInt(alumnoId) },
      estado_validacion: 'APROBADO',
    },
    orderBy: { fecha_pago: 'desc' },
    include: { cuentas_por_cobrar: { include: { catalogo_conceptos: true } } },
  });

  // Si tiene un plan pagado y ese plan no es vigente, es Legacy
  return ultimoPago?.cuentas_por_cobrar?.catalogo_conceptos?.es_vigente === false;
};

/**
 * Determina si es un Upgrade y calcula la fecha de corte del ciclo actual.
 */
export const calcularCicloUpgrade = async (tx, alumnoId) => {
  const hoy = new Date();
  const ultimaInscripcionActiva = await tx.inscripciones.findFirst({
    where: { alumno_id: parseInt(alumnoId), estado: 'ACTIVO' },
    orderBy: { fecha_inscripcion: 'desc' },
  });

  if (ultimaInscripcionActiva) {
    const fechaInicioCiclo = new Date(ultimaInscripcionActiva.fecha_inscripcion);
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