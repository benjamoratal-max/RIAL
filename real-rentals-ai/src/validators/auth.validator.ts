import { z } from 'zod';

// Validador para registro
// Nota: aunque el backend soporta varios roles internos (broker, broker_admin, team_member, compliance_admin, admin),
// el registro público solo debería usar tenant (renter) o broker_applicant (postulante a broker).
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  email: z.string()
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'La contraseña debe contener al menos una minúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número')
    .max(128, 'La contraseña no puede exceder 128 caracteres'),
  role: z.enum(['tenant', 'broker_applicant']).optional().default('tenant'),
});

// Validador para login (recaptchaToken se valida en ruta si RECAPTCHA_SECRET_KEY está definido)
export const loginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'La contraseña es requerida'),
  recaptchaToken: z.string().optional(),
  twoFactorCode: z.string().optional(),
});

// Tipo inferido para TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

