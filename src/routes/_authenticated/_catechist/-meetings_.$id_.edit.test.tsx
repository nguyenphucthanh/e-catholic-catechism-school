import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { Route } from './meetings_.$id_.edit'
import { useAuth } from '~/lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (options: any) => ({ options })),
  useParams: () => ({ id: 'm-1' }),
  useNavigate: () => navigateMock,
}))
vi.mock('~/components/forms/meeting-form', () => ({
  MeetingForm: ({ requesterId, meeting, onSuccess, onCancel }: any) => (
    <div data-testid="meeting-form">
      <span>{`${requesterId}|${meeting.title}`}</span>
      <button onClick={onSuccess}>success</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}))

let meeting: unknown

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

describe('EditMeetingPage', () => {
  beforeEach(() => {
    meeting = { _id: 'm-1', title: 'Họp T10', canManage: true }
    navigateMock.mockReset()
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'cat-1', accountType: 'catechist' } as any,
    })
    vi.mocked(useQuery).mockImplementation(((ref: any, args?: any) =>
      ref?.[Symbol.for('functionName')] === 'catechistMeetings:getMeeting' &&
      args !== 'skip'
        ? meeting
        : undefined) as any)
  })

  test('renders the form prefilled with the meeting for managers', () => {
    renderPage()
    expect(screen.getByText('meetings.edit.title')).toBeInTheDocument()
    expect(screen.getByText('cat-1|Họp T10')).toBeInTheDocument()
  })

  test('shows contactAdmin when the user cannot manage', () => {
    meeting = { _id: 'm-1', title: 'x', canManage: false }
    renderPage()
    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
    expect(screen.queryByTestId('meeting-form')).not.toBeInTheDocument()
  })

  test('shows not found when the meeting is missing or hidden', () => {
    meeting = null
    renderPage()
    expect(screen.getByText('meetings.notFound')).toBeInTheDocument()
  })

  test('shows no form while loading', () => {
    meeting = undefined
    renderPage()
    expect(screen.queryByTestId('meeting-form')).not.toBeInTheDocument()
    expect(screen.queryByText('meetings.notFound')).not.toBeInTheDocument()
  })

  test('success and cancel navigate to the meeting detail', () => {
    renderPage()
    fireEvent.click(screen.getByText('success'))
    fireEvent.click(screen.getByText('cancel'))
    expect(navigateMock).toHaveBeenCalledTimes(2)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/meetings/$id',
      params: { id: 'm-1' },
    })
  })
})
