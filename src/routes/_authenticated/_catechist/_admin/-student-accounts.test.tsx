import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAction, useMutation, usePaginatedQuery } from 'convex/react'
import { Route } from './student-accounts'

const mockStudent = {
  _id: 'stu-1',
  studentCode: 12,
  fullName: 'Lê Văn C',
  saintName: 'Phaolô',
  gender: 'male',
  isActive: true,
  isDeleted: false,
}

const mockAccount = {
  _id: 'acc-1',
  loginId: 'STD12',
  accountType: 'student',
  userRefId: 'stu-1',
  isActive: true,
  isDeleted: false,
}

function mockConvex() {
  vi.mocked(usePaginatedQuery).mockClear()
  vi.mocked(usePaginatedQuery).mockImplementation(
    () =>
      ({
        results: [{ student: mockStudent, account: mockAccount }],
        isLoading: false,
        status: 'Exhausted',
        loadMore: vi.fn(),
      }) as any,
  )
  vi.mocked(useMutation).mockImplementation((() => vi.fn()) as any)
  vi.mocked(useAction).mockImplementation((() => vi.fn()) as any)
}

function renderPage() {
  const Component = (Route as any).options.component
  return render(<Component />)
}

const lastArgs = () => {
  const calls = vi.mocked(usePaginatedQuery).mock.calls
  return calls[calls.length - 1][1] as any
}
const pick = (filterLabel: string, optionText: string) => {
  if (!screen.queryByRole('menuitem', { name: filterLabel })) {
    fireEvent.click(screen.getByRole('button', { name: /common\.filter/ }))
  }
  fireEvent.click(screen.getByRole('menuitem', { name: filterLabel }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: optionText }))
}
const removeBadge = () =>
  fireEvent.click(screen.getByRole('button', { name: /common\.removeFilter/ }))

describe('AdminStudentAccountsPage', () => {
  beforeEach(() => {
    mockConvex()
  })

  test('renders student rows with account status', () => {
    renderPage()
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument()
    expect(screen.getByText('STD12')).toBeInTheDocument()
    expect(
      screen.getByText('adminAccounts.status.hasAccount'),
    ).toBeInTheDocument()
  })

  test('no filters are applied by default', () => {
    renderPage()
    expect(lastArgs().accountStatus).toBeUndefined()
    expect(lastArgs().activeStatus).toBeUndefined()
  })

  test('accountStatus filter passes value to the query and badge X resets it', async () => {
    renderPage()
    pick('adminAccounts.col.accountStatus', 'adminAccounts.status.noAccount')
    await waitFor(() => expect(lastArgs().accountStatus).toBe('noAccount'))
    removeBadge()
    await waitFor(() => expect(lastArgs().accountStatus).toBeUndefined())
  })

  test.each([
    ['students.status.active', true],
    ['students.status.inactive', false],
  ])('activeStatus filter %s passes %s', async (option, expected) => {
    renderPage()
    pick('students.col.status', option)
    await waitFor(() => expect(lastArgs().activeStatus).toBe(expected))
  })

  test('activeStatus badge X resets arg to undefined', async () => {
    renderPage()
    pick('students.col.status', 'students.status.inactive')
    await waitFor(() => expect(lastArgs().activeStatus).toBe(false))
    removeBadge()
    await waitFor(() => expect(lastArgs().activeStatus).toBeUndefined())
  })
})
