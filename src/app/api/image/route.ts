import type { NextRequest } from 'next/server'

import { requireRouteAccess } from '@/rex/rex-access'
import { transcriptImage } from '@/transcripts/transcript-access'

export const GET = requireRouteAccess((request: NextRequest) => {
  const image = transcriptImage(request.nextUrl.searchParams.get('id') ?? '')
  if (!image) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'Cache-Control': 'private, max-age=86400',
      'Content-Type': image.mime,
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
