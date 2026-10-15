import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './meetings_.create'
import { useAuth } from '~/lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())
let selectedYearId: string | null = 'ay-1'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (options: any) => ({ options })),
  useNavigate: () => navigateMock,
}))
vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({ selectedYearId }),
}))
vi.mock('~/components/forms/meeting-form', () => ({
  MeetingForm: ({ requesterId, academicYearId, onSuccess, onCancel }: any) => (
    <div data-testid="meeting-form">
      <span>{`${requesterId}|${academicYearId}`}</span>
      <button onClick={onSuccess}>success</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}))

let perms: unknown

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

describe('CreateMeetingPage', () => {
  beforeEach(() => {
    selectedYearId = 'ay-1'
    perms = { isAdmin: true, isBoardMember: false }
    navigateMock.mockReset()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'cat-1', accountType: 'catechist' } as any,
    })
    vi.mocked(useQuery).mockImplementation(((ref: any, args?: any) =>
      ref?.[Symbol.for('functionName')] ===
        'catechistPermissions:getPermissions' && args !== 'skip'
        ? perms
        : undefined) as any)
  })

  test('renders the form for admins with requester and year', () => {
    renderPage()
    expect(screen.getByText('meetings.create.title')).toBeInTheDocument()
    expect(screen.getByText('cat-1|ay-1')).toBeInTheDocument()
  })

  test('renders the form for board members', () => {
    perms = { isAdmin: false, isBoardMember: true }
    renderPage()
    expect(screen.getByTestId('meeting-form')).toBeInTheDocument()
  })

  test('shows contactAdmin for other catechists', () => {
    perms = { isAdmin: false, isBoardMember: false }
    renderPage()
    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
    expect(screen.queryByTestId('meeting-form')).not.toBeInTheDocument()
  })

  test('shows a placeholder while permissions load or no year is selected', () => {
    perms = undefined
    const { unmount } = renderPage()
    expect(screen.queryByTestId('meeting-form')).not.toBeInTheDocument()
    expect(screen.queryByText('common.contactAdmin')).not.toBeInTheDocument()
    unmount()
    perms = { isAdmin: true, isBoardMember: false }
    selectedYearId = null
    renderPage()
    expect(screen.queryByTestId('meeting-form')).not.toBeInTheDocument()
  })

  test('success and cancel both navigate back to the list', () => {
    renderPage()
    fireEvent.click(screen.getByText('success'))
    fireEvent.click(screen.getByText('cancel'))
    expect(navigateMock).toHaveBeenCalledTimes(2)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/meetings' })
  })
})
