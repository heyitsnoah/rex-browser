import type { NextRequest } from 'next/server'

import { z } from 'zod'

/**
 * A GET route that parses search params and returns JSON.
 * Errors become `{ error }` with status 500 so the page can show the reason.
 */
export function jsonRoute<T extends z.ZodType>(
  schema: T,
  handler: (params: z.output<T>) => Promise<unknown>,
) {
  return async function GET(request: NextRequest) {
    const params = schema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    )
    if (!params.success) {
      return Response.json(
        { error: `Invalid request: ${z.prettifyError(params.error)}` },
        { status: 400 },
      )
    }
    try {
      return Response.json(await handler(params.data), {
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch (error) {
      return Response.json(
        {
          error:
            // A schema failing here is Rex or Tailscale output changing shape, not a bad request.
            error instanceof z.ZodError
              ? `Unexpected output: ${z.prettifyError(error)}`
              : error instanceof Error
                ? error.message
                : 'Request failed',
        },
        { status: 500 },
      )
    }
  }
}
