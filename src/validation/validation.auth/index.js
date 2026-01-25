import { loginSchema } from './login.validation.js';
import { refreshSchema } from './refresh.validation.js';
import { logoutSchema } from './logout.validation.js';

export const authSchemas = { loginSchema, refreshSchema, logoutSchema };
