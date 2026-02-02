import { z } from 'zod';

export const horarioSchema = {
  createHorarioSchema: z.object({
    cancha_id: z.union([
      z.number().int().positive('ID de cancha inválido'),
      z.string().regex(/^\d+$/, 'ID de cancha debe ser numérico').transform(Number)
    ]),
    profesor_id: z.union([
      z.number().int().positive('ID de profesor inválido'),
      z.string().regex(/^\d+$/, 'ID de profesor debe ser numérico').transform(Number)
    ]),
    nivel_id: z.union([
      z.number().int().positive('ID de nivel inválido'),
      z.string().regex(/^\d+$/, 'ID de nivel debe ser numérico').transform(Number)
    ]),
    dia_semana: z.union([
      z.number().int().min(1).max(7, 'Día de la semana debe estar entre 1 y 7'),
      z.string().regex(/^[1-7]$/, 'Día de la semana debe estar entre 1 y 7').transform(Number)
    ]),
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora de inicio inválido (HH:MM)'),
    hora_fin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora de fin inválido (HH:MM)'),
    capacidad_max: z.union([
      z.number().int().positive('Capacidad máxima debe ser positiva'),
      z.string().regex(/^\d+$/, 'Capacidad máxima debe ser numérica').transform(Number)
    ]).optional(),
    minutos_reserva_especifico: z.union([
      z.number().int().nonnegative('Minutos de reserva no pueden ser negativos'),
      z.string().regex(/^\d+$/, 'Minutos de reserva deben ser numéricos').transform(Number)
    ]).nullable().optional(),
  })
};
