import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { NavigateOptions } from '@tanstack/react-router'

type RedirectTarget = NavigateOptions | string

interface UseRouteGuardOptions {
  pending?: boolean
  allowed: boolean
  redirectTo: RedirectTarget | (() => RedirectTarget)
}

export function useRouteGuard({
  pending = false,
  allowed,
  redirectTo,
}: UseRouteGuardOptions): { ready: boolean } {
  const navigate = useNavigate()
  const ready = !pending && allowed

  useEffect(() => {
    if (pending || allowed) return
    const target = typeof redirectTo === 'function' ? redirectTo() : redirectTo
    if (typeof target === 'string') {
      void navigate({ to: target, replace: true })
    } else {
      void navigate({ ...target, replace: true })
    }
  }, [pending, allowed, navigate])

  return { ready }
}
