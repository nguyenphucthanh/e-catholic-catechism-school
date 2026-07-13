import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Global mock for window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Global mock for TanStack Router
vi.mock('@tanstack/react-router', () => {
  const useNavigate = vi.fn(() => vi.fn())
  const useLocation = vi.fn(() => ({
    pathname: '/',
  }))
  const useMatches = vi.fn(() => [])
  const createFileRoute = vi.fn(() => (options: any) => ({ options }))
  const lazyRouteComponent = vi.fn(() => () => null)
  const Navigate = vi.fn(({ to }: { to: string }) =>
    React.createElement('div', { 'data-testid': 'navigate', 'data-to': to }),
  )
  const Outlet = vi.fn(() =>
    React.createElement('div', { 'data-testid': 'outlet' }),
  )
  const Link = vi.fn(({ to, children, ...props }: any) =>
    React.createElement('a', { href: to, ...props }, children),
  )
  return {
    useNavigate,
    useLocation,
    useMatches,
    createFileRoute,
    lazyRouteComponent,
    Navigate,
    Outlet,
    Link,
  }
})

// Global mock for i18n translations
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

// Global mock for Convex React bindings
vi.mock('convex/react', () => ({
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useConvex: vi.fn(() => ({ query: vi.fn() })),
}))

// Global mock for Authentication Hook
vi.mock('~/lib/auth', () => {
  const useAuth = vi.fn(() => ({
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
  }))
  return { useAuth }
})

// Global mock for Sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
