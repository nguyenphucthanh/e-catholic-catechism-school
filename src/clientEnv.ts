import * as z from 'zod'

export const clientEnvSchema = z.object({
  VITE_CONVEX_URL: z.string().min(1, 'Convex url is required'),
  VITE_CONVEX_SITE_URL: z.string().min(1, 'Convex site url is required'),
  VITE_DEFAULT_LOCALE: z
    .string()
    .min(1, 'Default country is required')
    .default('vi-VN'),
  VITE_DEFAULT_TIMEZONE: z
    .string()
    .min(1, 'Timezone is required')
    .default('Asia/Ho_Chi_Minh'),
  VITE_DEMO_APP: z
    .string()
    .default('false')
    .transform((v) => v.toString() === 'true'),
  VITE_APP_LANDING: z
    .string()
    .default('false')
    .transform((v) => v.toString() === 'true'),
  VITE_SENTRY_DSN: z.string(),
})

export const clientEnv = clientEnvSchema.parse({
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
  VITE_DEFAULT_LOCALE: import.meta.env.VITE_DEFAULT_LOCALE,
  VITE_DEFAULT_TIMEZONE: import.meta.env.VITE_DEFAULT_TIMEZONE,
  VITE_DEMO_APP: import.meta.env.VITE_DEMO_APP,
  VITE_APP_LANDING: import.meta.env.VITE_APP_LANDING,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
})
