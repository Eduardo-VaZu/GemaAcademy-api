import { commonUsuarioSchemas } from './schemas/common.schema.js';
import { registerUserSchema } from './schemas/register.schema.js';
import { updateUserSchema } from './schemas/update.schema.js';

export const usuarioSchema = {
  ...commonUsuarioSchemas,
  registerUserSchema,
  updateUserSchema,
};
