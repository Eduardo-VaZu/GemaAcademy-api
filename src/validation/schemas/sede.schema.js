import z from 'zod';

const direccionSchema = z.object({
  direccion_completa: z
    .string({
      required_error: 'La dirección es requerida',
    })
    .trim()
    .min(3, 'La dirección debe tener al menos 3 caracteres')
    .max(255),
  distrito: z
    .string({
      required_error: 'El distrito es requerido',
    })
    .trim()
    .min(1, 'El distrito es requerido')
    .max(100),
  ciudad: z.string().trim().min(1, 'La ciudad es requerida').max(100).default('Lima').optional(),
  referencia: z.string().trim().min(1, 'La referencia es requerida').max(255).nullable().optional(),
});

export const sedeSchema = {
  createSedeSchema: z.object({
    nombre: z
      .string({
        required_error: 'El nombre es requerido',
      })
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),
    telefono_contacto: z
      .string({
        required_error: 'El teléfono es requerido',
      })
      .regex(/^[0-9+ ]+$/, 'El teléfono solo puede contener números, espacios y el símbolo +')
      .nullable()
      .optional(),
    tipo_instalacion: z
      .string()
      .trim()
      .max(50, 'El tipo de instalación no puede exceder 50 caracteres')
      .nullable()
      .optional(),
    activo: z.boolean().optional().default(true),
    direccion: direccionSchema,
  }),

  updateSedeSchema: z
    .object({
      nombre: z
        .string()
        .min(3, 'El nombre debe tener al menos 3 caracteres')
        .max(100, 'El nombre no puede exceder 100 caracteres')
        .trim()
        .optional(),

      telefono_contacto: z
        .string()
        .regex(/^\+?[0-9]{7,15}$/, 'Formato de teléfono inválido')
        .nullable()
        .optional(),

      tipo_instalacion: z
        .string()
        .max(50, 'El tipo de instalación no puede exceder 50 caracteres')
        .trim()
        .nullable()
        .optional(),

      activo: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Debe proporcionar al menos un campo para actualizar'
    ),

  sedeIdParamSchema: z.object({
    id: z
      .string()
      .regex(/^\d+$/, 'El ID debe ser un número')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'El ID debe ser mayor a 0'),
  }),

  sedeQuerySchema: z.object({
    activo: z
      .string()
      .transform((val) => val === 'true')
      .optional(),

    distrito: z.string().trim().optional(),

    tipo_instalacion: z.string().trim().optional(),

    page: z
      .string()
      .regex(/^\d+$/)
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0)
      .default('1')
      .optional(),

    limit: z
      .string()
      .regex(/^\d+$/)
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'El límite debe estar entre 1 y 100')
      .default('10')
      .optional(),
  }),
};
