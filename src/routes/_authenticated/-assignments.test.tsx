import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './assignments'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
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
  vi.mocked(useSelectedAcademicYear).mockReturnValue({
    selectedYearId: 'year123',
  } as any)
  vi.mocked(useAuth).mockReturnValue({
    user: { userDocId: 'admin123', role: 'admin' },
  } as any)
  vi.mocked(isAdmin).mockReturnValue(true)
})

describe('AssignmentsPage', () => {
  test('renders loading screen when data is undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)
    const PageComponent = (Route as any).options.component
    render(<PageComponent />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  test('renders tabs and headers when data is loaded', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(screen.getByText('assignments.title')).toBeInTheDocument()
    expect(screen.getByText('assignments.tabs.board')).toBeInTheDocument()
    expect(screen.getByText('assignments.tabs.branch')).toBeInTheDocument()
    expect(screen.getByText('assignments.tabs.class')).toBeInTheDocument()
  })

  test('renders edit button if user can edit and year is active', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    vi.mocked(isAdmin).mockReturnValue(true)

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(screen.getByText('assignments.edit.button')).toBeInTheDocument()
  })

  test('hides edit button if year is inactive', () => {
    const inactiveData = {
      ...mockAssignmentsData,
      academicYear: { ...mockAssignmentsData.academicYear, isActive: false },
    }
    vi.mocked(useQuery).mockReturnValue(inactiveData)
    vi.mocked(isAdmin).mockReturnValue(true)

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(
      screen.queryByText('assignments.edit.button'),
    ).not.toBeInTheDocument()
  })

  test('hides edit button if user is not authorized', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(
      screen.queryByText('assignments.edit.button'),
    ).not.toBeInTheDocument()
  })

  test('renders board members list on board tab', () => {
    vi.mocked(useQuery).mockReturnValue(mockAssignmentsData)
    const PageComponent = (Route as any).options.component
    render(<PageComponent />)

    expect(screen.getByText('assignments.board.title')).toBeInTheDocument()
    expect(screen.getByText('Catechist 1')).toBeInTheDocument()
  })
})
