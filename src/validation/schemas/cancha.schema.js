import { z } from 'zod';

export const canchaSchema = {
  createSchema: z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    tipo: z.string().min(3, 'El tipo debe tener al menos 3 caracteres'),
    sede_id: z.string().uuid('ID de sede inválido'),
  }),

  updateSchema: z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
    tipo: z.string().min(3, 'El tipo debe tener al menos 3 caracteres').optional(),
    sede_id: z.string().uuid('ID de sede inválido').optional(),
  }),
};
