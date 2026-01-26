import z from 'zod';
import { userCommonValidation } from '../common/common.validation.js';

const user = {
  baseUserSchema: z.object({
    email: userCommonValidation.emailSchema,
    password: userCommonValidation.passwordSchema,
    nombres: userCommonValidation.nameSchema,
    apellidos: userCommonValidation.nameSchema,
    tipo_documento_id: userCommonValidation.stringIdSchema.optional(),
    numero_documento: z.string().optional(),
    rol_id: z.string().optional().default('alumno'),
    telefono_personal: userCommonValidation.phoneSchema,
    fecha_nacimiento: userCommonValidation.dateSchema,
    genero: z.string().length(1).optional(),
  }),

  alumnoSpecificSchema: z.object({
    condiciones_medicas: z.string().optional(),
    seguro_medico: z.string().optional(),
    grupo_sanguineo: z.string().optional(),
  }),

  profesorSpecificSchema: z.object({
    especializacion: z.string().optional(),
    tarifa_hora: z
      .number()
      .or(z.string().transform((val) => parseFloat(val)))
      .optional(),
  }),

  administradorSpecificSchema: z.object({
    cargo: z.string().min(1, 'El cargo es obligatorio para administradores'),
    sede_id: z.number().int().nullable().optional(),
    area: z.string().optional(),
  }),
};

export const usuarioSchema = {
  registerUserSchema: user.baseUserSchema
    .extend({
      datosRolEspecifico: z.record(z.any()).optional(),
    })
    .superRefine((data, ctx) => {
      const rol = data.rol_id?.toLowerCase() || 'alumno';
      const datos = data.datosRolEspecifico || {};

      if (rol === 'alumno') {
        const result = user.alumnoSpecificSchema.safeParse(datos);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ['datosRolEspecifico', ...issue.path],
            });
          });
        }
      } else if (rol === 'profesor') {
        const result = user.profesorSpecificSchema.safeParse(datos);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ['datosRolEspecifico', ...issue.path],
            });
          });
        }
      } else if (rol === 'administrador') {
        const result = user.administradorSpecificSchema.safeParse(datos);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ['datosRolEspecifico', ...issue.path],
            });
          });
        }
      }
    }),
};
