import z from 'zod';
import { userCommonValidation } from './../common/common.validation.js';

export const authSchema = {
  loginSchema: z.object({
    email: userCommonValidation.emailSchema,
    password: userCommonValidation.passwordSchema,
  }),

  logoutSchema: z.object({
    refreshToken: z.string().min(1, 'Refresh token es requerido'),
  }),

  refreshSchema: z.object({
    refreshToken: z.string().min(1, 'Refresh token es requerido'),
  }),
};
