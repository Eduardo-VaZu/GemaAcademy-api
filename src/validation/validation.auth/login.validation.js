import { z } from 'zod';
import { userCommonValidation } from '../common/common.validation.js';

export const loginSchema = z.object({
  email: userCommonValidation.emailSchema,
  password: userCommonValidation.passwordSchema,
});
