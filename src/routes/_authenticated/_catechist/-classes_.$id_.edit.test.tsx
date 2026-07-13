import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Route } from './classes_.$id_.edit'
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

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any)
  vi.mocked(useParams).mockReturnValue({ id: 'class123' })
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

const sampleClass = {
  _id: 'class123',
  name: 'Ấu Nhi 1',
  branchId: 'branch123',
  description: 'Lớp ấu nhi',
  isDeleted: false,
}

const sampleBranches = [
  { _id: 'branch123', name: 'Ấu Nhi', sortOrder: 1, isDeleted: false },
]

function setupQueries(
  cls: any = undefined,
  branches: any = undefined,
  classesForYear: any = undefined,
  classYears: any = undefined,
) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'classes:get') return cls
    if (path === 'branches:list') return branches
    if (path === 'classes:list') return classesForYear
    if (path === 'classes:listClassYears') return classYears
    return undefined
  })
}

describe('EditClassPage', () => {
  test('renders unauthorized when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    setupQueries(undefined, undefined)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('renders skeleton while data is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(undefined, undefined)

    const EditPage = (Route as any).options.component
    const { container } = render(<EditPage />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders not found when class is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(null, sampleBranches)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('Class not found')).toBeInTheDocument()
  })

  test('renders form when data is available', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(sampleClass, sampleBranches)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('classes.edit.title')).toBeInTheDocument()
  })

  test('navigates to list on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(sampleClass, sampleBranches)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    fireEvent.click(screen.getByText('common.cancel'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
  })

  test('enables classType select when a classYearId is found for the selected year', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(
      sampleClass,
      sampleBranches,
      [{ ...sampleClass, classType: 'apostle' }],
      [{ classId: 'class123', classYearId: 'classYear123' }],
    )

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    const classTypeSelect = screen
      .getByText('classes.fields.classType')
      .closest('div')
      ?.querySelector('button')
    expect(classTypeSelect).not.toBeDisabled()
  })

  test('disables classType select when no classYearId is found for the selected year', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    setupQueries(sampleClass, sampleBranches, [], [])

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    const classTypeSelect = screen
      .getByText('classes.fields.classType')
      .closest('div')
      ?.querySelector('button')
    expect(classTypeSelect).toBeDisabled()
  })
})
