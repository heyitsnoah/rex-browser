import { z } from 'zod'

import { requireRouteAccess } from '@/rex/rex-access'
import { rexIdSchema } from '@/rex/rex-cli'
import { requireHost } from '@/rex/rex-hosts'
import { jsonRoute } from '@/workspace/json-route'
import { listTabs } from '@/workspace/workspace-listing'

export const GET = requireRouteAccess(
  jsonRoute(
    z.object({ host: z.string(), session: rexIdSchema }),
    async (params) =>
      listTabs({
        host: await requireHost(params.host),
        session: params.session,
      }),
  ),
)
