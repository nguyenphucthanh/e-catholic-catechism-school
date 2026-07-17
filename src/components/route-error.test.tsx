import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RouteError } from './route-error'

vi.mock('@sentry/tanstackstart-react', () => ({
  captureException: vi.fn(),
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
    const link = screen.getByRole('link', { name: /Trang chủ/ })
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

  test('calls Sentry.captureException with the error on mount', async () => {
    const Sentry = await import('@sentry/tanstackstart-react')
    const error = { message: 'Boom', name: 'Error' } as any
    render(<RouteError error={error} reset={vi.fn()} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })
})
