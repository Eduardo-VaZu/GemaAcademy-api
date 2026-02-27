import z from 'zod';

export const authSchema = {
  loginSchema: z.object({
    username: z.string()
      .trim()
      .toLowerCase()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(50, 'El nombre de usuario no puede exceder los 50 caracteres')
      .regex(/^[a-z0-9._áéíóúüñ]+$/, 'El username solo permite letras, números, puntos y guiones bajos')
      .transform(val =>
        val.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/ñ/g, "n")
      ),
    password: z.string().min(1, 'La contraseña es obligatoria'),
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