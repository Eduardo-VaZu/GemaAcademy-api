/**
 * Cuenta cuántas veces cae un día específico de la semana entre dos fechas.
 * @param {number} diaSemana - Día buscado (0-6, donde 0 es domingo o según configuración).
 * @param {Date} inicio - Fecha inicial.
 * @param {Date} fin - Fecha final.
 * @returns {number} Cantidad de ocurrencias.
 */
export const contarClasesEnIntervalo = (diaSemana, inicio, fin) => {
  let contador = 0;
  let puntero = new Date(inicio);
  puntero.setHours(12, 0, 0, 0); // Evitar problemas de zona horaria
  let finFijo = new Date(fin);
  finFijo.setHours(23, 59, 59, 999);

  while (puntero <= finFijo) {
    if (puntero.getDay() === diaSemana) contador++;
    puntero.setDate(puntero.getDate() + 1);
  }
  return contador;
};

/**
 * Valida que el input de horarios sea correcto.
 */
export const validarInputInscripcion = (horario_ids) => {
  if (!horario_ids || !Array.isArray(horario_ids) || horario_ids.length === 0) {
    throw new Error('Debes seleccionar al menos un horario.');
  }


  
};
/**
 * Calcula el rango de búsqueda para las inscripciones que deben renovarse.
 * @param {number} diasAnticipacion - Días antes del vencimiento para generar la deuda.
 */
export const calcularRangoRenovacion = (diasAnticipacion) => {
  const diasCiclo = 30;
  const diasAtras = diasCiclo - diasAnticipacion;

  const inicio = new Date();
  inicio.setDate(inicio.getDate() - diasAtras);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setHours(23, 59, 59, 999);

  return { inicio, fin };
};

/**
 * Calcula la fecha de vencimiento para la nueva deuda de renovación.
 */
export const calcularFechaVencimiento = (diasAnticipacion) => {
  return new Date(Date.now() + diasAnticipacion * 24 * 60 * 60 * 1000);
};