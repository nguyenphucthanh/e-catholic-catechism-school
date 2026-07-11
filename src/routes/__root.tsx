import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'
import { Toaster } from '~/components/ui/sonner'
import { TooltipProvider } from '~/components/ui/tooltip'
import { AuthProvider } from '~/lib/auth'
import { AcademicYearProvider } from '~/lib/academic-year'
import i18n from '~/lib/i18n'
import { AuthErrorBoundary } from '~/components/auth-error-boundary'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  beforeLoad: async ({ context, location }) => {
    const hasAdmin = await context.queryClient.ensureQueryData(
      convexQuery(api.setup.hasAdmin, {}),
    )
    if (!hasAdmin && location.pathname !== '/setup') {
      throw redirect({ to: '/setup' })
    }
    if (hasAdmin && location.pathname === '/setup') {
      throw redirect({ to: '/login' })
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Trường Giáo Lý',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) =>
          console.log('Service Worker registered with scope:', reg.scope),
        (err) => console.error('Service Worker registration failed:', err),
      )
    }
  }, [])

  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <I18nextProvider i18n={i18n}>
            <TooltipProvider>
              <AuthErrorBoundary>
                <AcademicYearProvider>{children}</AcademicYearProvider>
              </AuthErrorBoundary>
            </TooltipProvider>
            <Toaster richColors position="bottom-right" />
          </I18nextProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
