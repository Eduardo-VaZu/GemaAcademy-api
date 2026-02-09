import z from 'zod';
import { userCommonValidation } from './../common/common.validation.js';

export const authSchema = {
  loginSchema: z.object({
    email: z.string()
      .trim()
      .toLowerCase()
      .email('Email inválido')
      .optional(),

    numero_documento: z.string()
      .trim()
      .min(8, 'El documento debe tener al menos 8 caracteres')
      .max(15)
      .optional(),

    password: z.string().min(1, 'La contraseña es obligatoria'),
  }).refine((data) => data.email || data.numero_documento, {
    message: "Debe proporcionar el email o el número de documento",
    path: ["email"],
  }),

  logoutSchema: z.object({}).passthrough(),

  refreshSchema: z.object({}).passthrough(),

  completarEmailSchema: z.object({
    email: z.string()
      .trim()
      .toLowerCase()
      .email('Email inválido')
  }),
};
