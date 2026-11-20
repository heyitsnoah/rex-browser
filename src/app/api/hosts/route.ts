import { z } from 'zod'

import { requireRouteAccess } from '@/rex/rex-access'
import { discoverHosts } from '@/rex/rex-hosts'
import { jsonRoute } from '@/workspace/json-route'

export const GET = requireRouteAccess(
  jsonRoute(z.object({}), () => discoverHosts()),
)
