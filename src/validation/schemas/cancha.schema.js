import { z } from 'zod';

export const canchaSchema = {
  createSchema: z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    tipo: z.string().max(200, 'La descripción es muy larga').optional(),
    sede_id: z.number({ required_error: 'Sede ID es requerido' }).positive(),
  }),

  updateSchema: z.object({
    nombre: z.string().min(3).optional(),
    descripcion: z.string().max(200).optional(),
    sede_id: z.number().positive().optional(),
  }),
};
