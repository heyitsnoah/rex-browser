import type { NextConfig } from 'next'

import { withDotenvx } from '@alephic/dotenvx-next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '26mb' },
    // Next 16.3 defaults to running the `tsc` CLI, which needs
    // `typescript/bin/tsc`. `typescript` is aliased to the TS 6 API compat
    // package (see package.json), which only ships `tsc6`, so keep Next on
    // the compiler API.
    useTypeScriptCli: false,
  },
  poweredByHeader: false,
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: true, // handled in CI
  },
}

export default withDotenvx(nextConfig)
