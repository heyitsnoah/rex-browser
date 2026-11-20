import { Suspense } from 'react'

import { requirePageAccess } from '@/rex/rex-access'
import { Workspace } from '@/workspace/components/workspace'

export default requirePageAccess(() => {
  // The open tab lives in the URL's search params, which Workspace reads on the client.
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  )
})
