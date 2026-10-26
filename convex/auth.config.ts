import { env } from './_generated/server'
import type { AuthConfig } from 'convex/server'

// Tokens are signed by this deployment itself via ctx.auth.signJwt.
export default {
  providers: [
    {
      type: 'customJwt',
      applicationID: 'giaoly',
      issuer: env.CONVEX_CLOUD_URL,
      jwks: `${env.CONVEX_CLOUD_URL}/.well-known/jwks.json`,
      algorithm: 'ES256',
    },
  ],
} satisfies AuthConfig
