import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token es requerido'),
});
