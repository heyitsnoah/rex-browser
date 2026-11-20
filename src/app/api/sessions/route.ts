import { z } from 'zod'

import { requireRouteAccess } from '@/rex/rex-access'
import { requireHost } from '@/rex/rex-hosts'
import { jsonRoute } from '@/workspace/json-route'
import { listSessions } from '@/workspace/workspace-listing'

export const GET = requireRouteAccess(
  jsonRoute(z.object({ host: z.string() }), async (params) =>
    listSessions(await requireHost(params.host)),
  ),
)
