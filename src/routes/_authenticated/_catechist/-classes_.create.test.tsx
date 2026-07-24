import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { Route } from './classes_.create'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
}))

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useMutation).mockClear()
  vi.mocked(useQuery).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

const sampleBranches = [
  { _id: 'branch123', name: 'Ấu Nhi', sortOrder: 1, isDeleted: false },
]

describe('CreateClassPage', () => {
  test('renders unauthorized when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('renders skeleton while branches are loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const CreatePage = (Route as any).options.component
    const { container } = render(<CreatePage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders form when branches are loaded', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleBranches)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('classes.create.title')).toBeInTheDocument()
  })

  test('renders alert when branches list is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue([])

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('classes.noBranch.title')).toBeInTheDocument()
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockReturnValue(sampleBranches)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
  })
})
