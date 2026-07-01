import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { Route } from './branches_.create'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useMutation).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

describe('CreateBranchPage', () => {
  test('renders unauthorized when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('renders form when authorized', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('branches.create.title')).toBeInTheDocument()
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/branches' })
  })
})
