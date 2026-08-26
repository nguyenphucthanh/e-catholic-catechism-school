import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { RouteError } from './route-error'

vi.mock('@sentry/tanstackstart-react', () => ({
  captureException: vi.fn(),
}))

const mockNavigate = vi.fn()
const mockLogout = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: React.forwardRef(({ children, to, ...props }: any, ref: any) => (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )),
}))

vi.mock('~/lib/auth', () => ({
  useAuth: () => ({ logout: mockLogout }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

describe('RouteError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: vi.fn() },
    })
  })

  test('renders the error message when present', () => {
    render(
      <RouteError
        error={{ message: 'Boom', name: 'Error' } as any}
        reset={vi.fn()}
      />,
    )
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })

  test('falls back to default text when error message is empty', () => {
    render(
      <RouteError
        error={{ message: '', name: 'Error' } as any}
        reset={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Vui lòng thử lại hoặc quay về trang chủ.'),
    ).toBeInTheDocument()
  })

  test('reload button calls window.location.reload', () => {
    render(
      <RouteError
        error={{ message: 'Boom', name: 'Error' } as any}
        reset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  test('renders a link to the home page', () => {
    render(
      <RouteError
        error={{ message: 'Boom', name: 'Error' } as any}
        reset={vi.fn()}
      />,
    )
    const link = screen.getByRole('button', { name: /Trang chủ/ })
    expect(link).toHaveAttribute('href', '/')
  })

  test('does not render the details toggle when there is no stack', () => {
    render(
      <RouteError
        error={{ message: 'Boom', name: 'Error' } as any}
        reset={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Chi tiết lỗi/ }),
    ).not.toBeInTheDocument()
  })

  test('toggles the stack trace details when a stack is present', () => {
    const error = {
      message: 'Boom',
      name: 'Error',
      stack: 'Error: Boom at foo.ts:1:1',
    } as any
    render(<RouteError error={error} reset={vi.fn()} />)

    expect(screen.queryByText(error.stack)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chi tiết lỗi/ }))
    expect(screen.getByText(error.stack)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chi tiết lỗi/ }))
    expect(screen.queryByText(error.stack)).not.toBeInTheDocument()
  })

  test('calls Sentry.captureException with the error on mount for non-auth errors', async () => {
    const Sentry = await import('@sentry/tanstackstart-react')
    const error = { message: 'Boom', name: 'Error' } as any
    render(<RouteError error={error} reset={vi.fn()} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  test('triggers forced logout and navigation to /login on auth error', async () => {
    const { toast } = await import('sonner')
    const error = new Error('AUTHZ_STUDENT_NOT_FOUND')
    render(<RouteError error={error} reset={vi.fn()} />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'auth.profile_not_found',
        expect.objectContaining({ description: 'auth.forced_logout' }),
      )
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    })
  })
})
