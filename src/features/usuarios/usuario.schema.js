import z from 'zod';
import { userCommonValidation } from '../../shared/validation/common.validation.js';
import { VALID_ROLES_ARRAY, ROLE_REQUIRED_FIELDS } from '../roles/roles.constants.js';

const emptyToUndefined = (schema) => z.preprocess((val) => (val === '' ? undefined : val), schema);

const direccionSchema = z.object({
  direccion_completa: z
    .string({
      required_error: 'La dirección es requerida',
    })
    .trim()
    .min(3, 'La dirección debe tener al menos 3 caracteres')
    .max(255),
  distrito: z
    .string({
      required_error: 'El distrito es requerido',
    })
    .trim()
    .min(1, 'El distrito es requerido')
    .max(100),
  ciudad: z.string().trim().min(1, 'La ciudad es requerida').max(100).default('Lima').optional(),
  referencia: z.string().trim().min(1, 'La referencia es requerida').max(255).nullable().optional(),
});

const user = {
  baseUserSchema: z.object({
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
          errorMap: (issue, ctx) => ({
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
        errorMap: () => ({
          message: 'Género debe ser M (Masculino), F (Femenino) u O (Otro)',
        }),
      })
      .optional(),
  }),

  alumnoSpecificSchema: z.object({
    condiciones_medicas: z
      .string()
      .max(500, 'Condiciones médicas no puede exceder 500 caracteres')
      .optional(),
    seguro_medico: z
      .string()
      .max(100, 'Nombre del seguro no puede exceder 100 caracteres')
      .optional(),
    grupo_sanguineo: z
      .enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], {
        errorMap: () => ({
          message: 'Grupo sanguíneo inválido. Valores permitidos: O+, O-, A+, A-, B+, B-, AB+, AB-',
        }),
      })
      .optional(),
    direccion: direccionSchema,
  }),

  coordinadorSpecificSchema: z.object({
    especializacion: z
      .string()
      .min(3, 'Especialización debe tener al menos 3 caracteres')
      .max(100, 'Especialización no puede exceder 100 caracteres')
      .optional(),
    tarifa_hora: z
      .union([
        z.number().positive('Tarifa por hora debe ser un número positivo').max(9999),
        z.string().transform((val) => parseFloat(val)),
      ])
      .refine((val) => val > 0, 'Tarifa por hora debe ser mayor a 0')
      .optional(),
  }),

  administradorSpecificSchema: z.object({
    cargo: z
      .string({
        required_error: 'Campo "cargo" es obligatorio para administradores',
      })
      .min(3, 'Cargo debe tener al menos 3 caracteres')
      .max(100, 'Cargo no puede exceder 100 caracteres'),

    sede_id: z.number().int().positive('Sede ID debe ser un número positivo').nullable().optional(),

    area: z
      .string()
      .min(3, 'Área debe tener al menos 3 caracteres')
      .max(100, 'Área no puede exceder 100 caracteres')
      .optional(),
  }),
};

export const usuarioSchema = {
  registerUserSchema: user.baseUserSchema
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

      if (typeof rol === 'number') {
        return; // Validation deferred to service
      }

      if (!VALID_ROLES_ARRAY.includes(rol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_enum_value,
          path: ['rol_id'],
          message: `Rol inválido. Valores permitidos: ${VALID_ROLES_ARRAY.join(', ')}`,
          options: VALID_ROLES_ARRAY,
          received: rol,
        });
      }

      if (rol === 'alumno') {
        const result = user.alumnoSpecificSchema.safeParse(datos);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ['datosRolEspecifico', ...issue.path],
            });
          });
        }
      } else if (rol === 'coordinador') {
        const result = user.coordinadorSpecificSchema.safeParse(datos);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ['datosRolEspecifico', ...issue.path],
            });
          });
        }
      } else if (rol === 'administrador') {
        const result = user.administradorSpecificSchema.safeParse(datos);
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
    }),
  updateUserSchema: z
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
      const {
        username,
        email,
        password,
        direccion_completa,
        distrito,
        ciudad,
        referencia,
        contacto_emergencia,
        datosRolEspecifico,
      } = data;

      const fieldsToUpdate = [
        username,
        email,
        password,
        direccion_completa,
        distrito,
        ciudad,
        referencia,
        contacto_emergencia,
        datosRolEspecifico,
      ];

      const hasAnyField = fieldsToUpdate.some((value) => value !== undefined);

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
    }),

  idParamSchema: z.object({
    id: z
      .string()
      .regex(/^\d+$/, 'El ID debe ser un número')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'El ID debe ser mayor a 0'),
  }),

  rolParamSchema: z.object({
    rol: z
      .string({ required_error: 'El rol es requerido' })
      .trim()
      .min(1, 'El rol es requerido')
      .max(50),
  }),

  validateRoleSchema: z.object({
    rol_id: z.union([z.enum(VALID_ROLES_ARRAY), z.number().int().positive()]),
    datosRolEspecifico: z.record(z.any()).optional().default({}),
  }),
};
