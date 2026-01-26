import z from 'zod';
import { userCommonValidation } from './../common/common.validation.js';

export const authSchema = {
  loginSchema: z.object({
    email: userCommonValidation.emailSchema,
    password: userCommonValidation.passwordSchema,
  }),

  logoutSchema: z.object({}).passthrough(),

  refreshSchema: z.object({}).passthrough(),
};
