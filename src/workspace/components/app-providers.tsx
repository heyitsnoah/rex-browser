'use client'

import type { ReactNode } from 'react'

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

const DAY = 24 * 60 * 60 * 1000

/** Theme, plus queries cached in localStorage so a reopened page shows the last view at once. */
export function AppProviders(props: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { gcTime: DAY, retry: 1, staleTime: 2_000 },
        },
      }),
  )
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      key: 'rex-browser',
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
    }),
  )
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <PersistQueryClientProvider
        client={client}
        persistOptions={{
          dehydrateOptions: {
            // Screens change every second and conversations can be large; keep only the open one.
            shouldDehydrateQuery: (query) =>
              query.state.status === 'success' &&
              query.queryKey[0] !== 'screen' &&
              (query.queryKey[0] !== 'conversation' || query.isActive()),
          },
          maxAge: DAY,
          persister,
        }}
      >
        {props.children}
      </PersistQueryClientProvider>
    </ThemeProvider>
  )
}
