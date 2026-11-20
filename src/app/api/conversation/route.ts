import { z } from 'zod'

import { requireRouteAccess } from '@/rex/rex-access'
import { rexIdSchema } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { readConversation } from '@/transcripts/transcript-access'
import { jsonRoute } from '@/workspace/json-route'

export const GET = requireRouteAccess(
  jsonRoute(
    z.object({
      block: rexIdSchema,
      host: z.string(),
      session: rexIdSchema,
      transcript: z.string().optional(),
    }),
    async (params) =>
      readConversation({
        block: params.block,
        host: await requireHost(params.host),
        session: params.session,
        transcript: params.transcript,
      }),
  ),
)
