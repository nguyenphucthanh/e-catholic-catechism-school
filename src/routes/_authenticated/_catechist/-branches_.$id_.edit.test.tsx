import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Route } from './branches_.$id_.edit'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any)
  vi.mocked(useParams).mockReturnValue({ id: 'branch123' })
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

const sampleBranch = {
  _id: 'branch123',
  name: 'Ấu Nhi',
  sortOrder: 1,
  description: 'Mô tả ấu nhi',
  isDeleted: false,
}

describe('EditBranchPage', () => {
  test('renders unauthorized when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('renders skeleton while branch data is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const EditPage = (Route as any).options.component
    const { container } = render(<EditPage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders not found when branch is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(null)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('Branch not found')).toBeInTheDocument()
  })

  test('renders form when branch data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleBranch)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('branches.edit.title')).toBeInTheDocument()
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleBranch)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/branches' })
  })
})
