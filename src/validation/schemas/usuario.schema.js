import z from 'zod';
import { userCommonValidation } from '../common/common.validation.js';
import { VALID_ROLES_ARRAY, ROLE_REQUIRED_FIELDS } from '../../constants/roles.constants.js';

const user = {
  baseUserSchema: z.object({
    email: userCommonValidation.emailSchema,
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
  }),

  profesorSpecificSchema: z.object({
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
      } else if (rol === 'profesor') {
        const result = user.profesorSpecificSchema.safeParse(datos);
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
};
