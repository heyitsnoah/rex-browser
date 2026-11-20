import { z } from 'zod'

import { requireRouteAccess } from '@/rex/rex-access'
import { rexIdSchema, rexJson } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { jsonRoute } from '@/workspace/json-route'

export const GET = requireRouteAccess(
  jsonRoute(
    z.object({ block: rexIdSchema, host: z.string(), session: rexIdSchema }),
    async (params) =>
      rexJson({
        args: [
          'block',
          'call',
          '-s',
          params.session,
          '-b',
          params.block,
          'format',
          JSON.stringify({ format: 'text', trim: true }),
        ],
        host: await requireHost(params.host),
        schema: z.object({ content: z.string() }),
      }),
  ),
)
