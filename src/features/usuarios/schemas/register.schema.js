import z from 'zod';
import { userCommonValidation } from '../../../shared/validation/common.validation.js';
import { VALID_ROLES_ARRAY, ROLE_REQUIRED_FIELDS } from '../../roles/roles.constants.js';
import { rolesSpecificSchemas } from './roles.schema.js';

export const baseUserSchema = z.object({
  username: z
    .string({ required_error: 'El nombre de usuario es obligatorio' })
    .trim()
    .toLowerCase()
    .min(3, 'El username debe tener al menos 3 caracteres')
    .max(50)
    .regex(/^[a-z0-9._]+$/, 'Solo letras, números, puntos y guiones bajos')
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .nullable()
    .optional()
    .or(z.literal('')),
  password: userCommonValidation.passwordSchema,
  nombres: userCommonValidation.nameSchema,
  apellidos: userCommonValidation.nameSchema,
  tipo_documento_id: userCommonValidation.stringIdSchema.optional(),
  numero_documento: z
    .string()
    .min(5, 'El número de documento debe tener al menos 5 caracteres')
    .max(20, 'El número de documento debe tener menos de 15 caracteres')
    .optional(),
  rol_id: z
    .union([
      z.enum(VALID_ROLES_ARRAY, {
        errorMap: () => ({
          message: `Rol inválido. Valores permitidos: ${VALID_ROLES_ARRAY.join(', ')}`,
        }),
      }),
      z.number().int().positive('El ID del rol debe ser un número positivo'),
    ])
    .default('alumno'),
  telefono_personal: userCommonValidation.phoneSchema,
  fecha_nacimiento: userCommonValidation.dateSchema,
  genero: z
    .enum(['M', 'F', 'O'], {
      errorMap: () => ({ message: 'Género debe ser M (Masculino), F (Femenino) u O (Otro)' }),
    })
    .optional(),
});

export const registerUserSchema = baseUserSchema
  .extend({
    datosRolEspecifico: z.record(z.any()).optional(),
  })
  .superRefine((data, ctx) => {
    let rol = data.rol_id;
    if (typeof rol === 'string') {
      rol = rol.toLowerCase();
    } else if (!rol) {
      rol = 'alumno';
    }
    const datos = data.datosRolEspecifico || {};

    if (typeof rol === 'number') return;

    if (!VALID_ROLES_ARRAY.includes(rol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_enum_value,
        path: ['rol_id'],
        message: `Rol inválido. Valores permitidos: ${VALID_ROLES_ARRAY.join(', ')}`,
        options: VALID_ROLES_ARRAY,
        received: rol,
      });
    }

    const schemasMap = {
      alumno: rolesSpecificSchemas.alumnoSpecificSchema,
      coordinador: rolesSpecificSchemas.coordinadorSpecificSchema,
      administrador: rolesSpecificSchemas.administradorSpecificSchema,
    };

    if (schemasMap[rol]) {
      const result = schemasMap[rol].safeParse(datos);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['datosRolEspecifico', ...issue.path],
          });
        });
      }
    }

    const requiredFields = ROLE_REQUIRED_FIELDS[rol] || [];
    requiredFields.forEach((field) => {
      if (!datos[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          path: ['datosRolEspecifico', field],
          expected: 'string',
          received: typeof datos[field],
          message: `Campo "${field}" es obligatorio para el rol ${rol}`,
        });
      }
    });
  });
