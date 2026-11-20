import { loadEnv } from '@alephic/dotenvx-next'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

loadEnv()

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    // Both set: also serve the tailnet name behind Tailscale Serve, to that login only.
    REX_BROWSER_HOST: z.string().optional(),
    REX_BROWSER_LOGIN: z.string().optional(),
  },
})
