/**
 * Resuelve el ID del método de pago, ya sea por número o por nombre.
 */
export const resolverMetodoPagoId = async (tx, metodo_pago) => {
  if (!isNaN(metodo_pago)) {
    return Number.parseInt(metodo_pago);
  }

  const metodoEncontrado = await tx.metodos_pago.findFirst({
    where: { nombre: { contains: metodo_pago, mode: 'insensitive' } },
  });

  if (!metodoEncontrado) {
    const defaultMetodo = await tx.metodos_pago.findFirst();
    if (!defaultMetodo) throw new Error('Error técnico: No hay métodos de pago.');
    return defaultMetodo.id;
  }

  return metodoEncontrado.id;
};
/**
 * Suma abonos anteriores y determina si la deuda se salda.
 */
export const calcularSaldosAlcancía = async (tx, pagoActual) => {
  const pagosAnteriores = await tx.pagos.aggregate({
    where: {
      cuenta_id: pagoActual.cuenta_id,
      estado_validacion: 'APROBADO',
      id: { not: pagoActual.id },
    },
    _sum: { monto_pagado: true },
  });

  const totalPrevio = pagosAnteriores._sum.monto_pagado || 0;
  const totalConEstePago = totalPrevio + Number(pagoActual.monto_pagado);
  const deudaTotal = Number(pagoActual.cuentas_por_cobrar.monto_final);

  const saldoRestante = Math.max(0, deudaTotal - totalConEstePago);
  const esPagoCompleto = saldoRestante <= 0.1; // Margen para evitar problemas de redondeo

  return { saldoRestante, esPagoCompleto };
};

/**
 * Define los nuevos estados de la Deuda e Inscripción.
 */
export const definirEvolucionDeEstados = async (tx, pago, esAprobado, esPagoCompleto) => {
  if (!esAprobado) {
    // Si rechazo, veo si antes ya había pagado algo para dejarlo en PARCIAL o PENDIENTE
    const aprobados = await tx.pagos.count({
      where: { cuenta_id: pago.cuenta_id, estado_validacion: 'APROBADO' },
    });
    
    return {
      nuevoEstadoDeuda: aprobados > 0 ? 'PARCIAL' : 'PENDIENTE',
      activarAlumno: false
    };
  }

  return {
    nuevoEstadoDeuda: esPagoCompleto ? 'PAGADA' : 'PARCIAL',
    activarAlumno: true
  };
};