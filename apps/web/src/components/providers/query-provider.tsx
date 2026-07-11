'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Client-side server-state provider. One QueryClient per browser session,
 * created lazily via useState so it survives re-renders without being shared
 * across requests on the server. Queries are cached and de-duplicated by key,
 * so navigating between pages that read the same resource no longer re-fetches.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
