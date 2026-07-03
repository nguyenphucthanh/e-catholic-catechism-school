import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Route } from './assignments_.edit'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
  isBoardMember: vi.fn(),
}))

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
}))

const mockAssignmentsData = {
  academicYear: {
    _id: 'year123',
    name: '2024-2025',
    isActive: true,
    isDeleted: false,
  },
  activeCatechists: [
    {
      _id: 'cat1',
      fullName: 'Catechist 1',
      memberId: '1',
      role: 'user',
      isActive: true,
      isDeleted: false,
    },
    {
      _id: 'cat2',
      fullName: 'Catechist 2',
      memberId: '2',
      role: 'user',
      isActive: true,
      isDeleted: false,
    },
  ],
  activeBranches: [
    { _id: 'branch1', name: 'Chiên Con', sortOrder: 1, isDeleted: false },
  ],
  classDetails: [
    {
      classYearId: 'cy1',
      classId: 'class1',
      className: 'Chiên Con 1',
      branchName: 'Chiên Con',
    },
  ],
  boardMembers: {
    catechistIds: ['cat1'],
    catechists: [{ _id: 'cat1', fullName: 'Catechist 1' }],
  },
  branchHeads: {
    byBranch: {
      branch1: {
        catechistIds: ['cat2'],
        catechists: [{ _id: 'cat2', fullName: 'Catechist 2' }],
        branchName: 'Chiên Con',
      },
    },
  },
  classTeachers: {
    byClass: {
      cy1: {
        homeroom: {
          catechistId: 'cat1',
          catechist: { _id: 'cat1', fullName: 'Catechist 1' },
        },
        coTeachers: [
          {
            catechistId: 'cat2',
            catechist: { _id: 'cat2', fullName: 'Catechist 2' },
          },
        ],
      },
    },
  },
}

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any)
  vi.mocked(useSelectedAcademicYear).mockReturnValue({
    selectedYearId: 'year123',
  } as any)
  vi.mocked(useAuth).mockReturnValue({
    user: { userDocId: 'admin123', role: 'admin' },
  } as any)
  vi.mocked(isAdmin).mockReturnValue(true)
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('AssignmentsEditPage', () => {
  test('renders loading screen when data is undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)
    const PageComponent = (Route as any).options.component
    render(<PageComponent />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  test('redirects to assignments if year is inactive', async () => {
    const inactiveData = {
      ...mockAssignmentsData,
      academicYear: { ...mockAssignmentsData.academicYear, isActive: false },
    }
    vi.mocked(useQuery).mockReturnValue(inactiveData)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/assignments' })
    })
  })

  test('redirects to assignments if user is not allowed to edit', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/assignments' })
  })

  test('renders edit tabs and save buttons', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(screen.getByText('assignments.edit.title')).toBeInTheDocument()
    expect(
      screen.getAllByText('assignments.class.save').length,
    ).toBeGreaterThan(0)
  })

  test('calls updateBoard when saving board members', async () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    const saveBoardMock = vi.fn().mockResolvedValue({ success: true })
    vi.mocked(useMutation).mockImplementation((apiRef: any) => {
      const name = apiRef?.[Symbol.for('functionName')]
      if (name === 'assignments:updateBoardAssignments') return saveBoardMock
      return vi.fn() as any
    })

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    fireEvent.click(screen.getAllByText('assignments.class.save')[0])

    await waitFor(() => {
      expect(saveBoardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          academicYearId: 'year123',
          catechistIds: ['cat1'],
        }),
      )
    })
  })
})
