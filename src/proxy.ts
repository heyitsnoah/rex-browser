import { type NextRequest, NextResponse } from 'next/server'

import { isAllowedRequest } from '@/rex/rex-access'

export function proxy(request: NextRequest) {
  if (!isAllowedRequest(request.headers)) {
    return new NextResponse(null, { status: 403 })
  }
  return NextResponse.next()
}
