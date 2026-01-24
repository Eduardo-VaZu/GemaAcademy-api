import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'El email es requerido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña es demasiado larga'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'El email es requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  nombres: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  apellidos: z
    .string()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(100, 'El apellido es demasiado largo'),
  rol_id: z.number().int('El rol debe ser un número entero').positive('El rol debe ser mayor a 0'),
});

export const refreshSchema = z.object({
  // Si el token viene por cookie, este esquema puede ser un objeto vacío
  // o podrías validar que no vengan parámetros inesperados en el body.
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token es requerido'),
});

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Errores de validación',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};

// Mantener authValidation por si se usa en otros sitios
export const authValidation = {
  loginSchema,
  registerSchema,
  refreshSchema,
  logoutSchema,
  validate,
};
