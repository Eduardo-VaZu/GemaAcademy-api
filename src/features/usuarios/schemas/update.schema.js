import z from 'zod';
import { userCommonValidation } from '../../../shared/validation/common.validation.js';

const emptyToUndefined = (schema) => z.preprocess((val) => (val === '' ? undefined : val), schema);

export const updateUserSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(3).max(50).optional(),
    email: z.string().trim().toLowerCase().email().nullable().optional(),
    password: emptyToUndefined(userCommonValidation.passwordSchema).optional(),
    direccion_completa: emptyToUndefined(z.string().trim().min(3).max(255)).optional(),
    distrito: emptyToUndefined(z.string().trim().min(1).max(100)).optional(),
    ciudad: emptyToUndefined(z.string().trim().min(1).max(100)).optional(),
    referencia: emptyToUndefined(z.string().trim().min(1).max(255)).optional().nullable(),
    contacto_emergencia: z
      .object({
        nombre_completo: emptyToUndefined(z.string().trim().min(3).max(150)).optional(),
        telefono: emptyToUndefined(z.string().trim().min(7).max(20)).optional(),
        relacion: emptyToUndefined(z.string().trim().min(1).max(50)).optional().nullable(),
      })
      .optional(),
    datosRolEspecifico: z
      .object({
        condiciones_medicas: emptyToUndefined(z.string().max(500)).optional(),
        seguro_medico: emptyToUndefined(z.string().max(100)).optional(),
        grupo_sanguineo: emptyToUndefined(
          z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
        ).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const { contacto_emergencia, ...otrosCampos } = data;
    const hasAnyField =
      Object.values(otrosCampos).some((v) => v !== undefined) || contacto_emergencia !== undefined;

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Debe proporcionar al menos un campo para actualizar',
      });
    }

    if (contacto_emergencia) {
      const { nombre_completo, telefono } = contacto_emergencia;
      if (Object.values(contacto_emergencia).some((v) => v !== undefined)) {
        if (!nombre_completo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['contacto_emergencia', 'nombre_completo'],
            message: 'Nombre completo es requerido para el contacto de emergencia',
          });
        }
        if (!telefono) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['contacto_emergencia', 'telefono'],
            message: 'Teléfono es requerido para el contacto de emergencia',
          });
        }
      }
    }
  });
