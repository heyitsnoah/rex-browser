import type { NextRequest } from 'next/server'
import type { z } from 'zod'

/**
 * A GET route that parses search params and returns JSON.
 * Errors become `{ error }` with status 500 so the page can show the reason.
 */
export function jsonRoute<T extends z.ZodType>(
  schema: T,
  handler: (params: z.output<T>) => Promise<unknown>,
) {
  return async function GET(request: NextRequest) {
    try {
      return Response.json(
        await handler(
          schema.parse(Object.fromEntries(request.nextUrl.searchParams)),
        ),
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Request failed' },
        { status: 500 },
      )
    }
  }
}
