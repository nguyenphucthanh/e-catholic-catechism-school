import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HeaderSearch } from './header-search'
import type { Id } from '../../convex/_generated/dataModel'
import type { AuthUser } from '~/lib/auth'
import { useAuth } from '~/lib/auth'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'

vi.mock('~/hooks/use-one-shot-query', () => ({
  useOneShotQuery: vi.fn(),
}))

const oneShot = (data: unknown) =>
  ({ data, isRefreshing: false, refresh: vi.fn() }) as never

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: vi.fn(() => navigateMock),
  }
})

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userDocId: 'catechist1',
    loginId: 'login1',
    memberId: 'M001',
    fullName: 'Nguyen Van A',
    accountType: 'catechist',
    role: 'user',
    sessionId: 's1',
    sessionSecret: 'secret',
    ...overrides,
  }
}

const studentsFixture = [
  {
    _id: 'student1' as Id<'students'>,
    saintName: 'Maria',
    fullName: 'Tran Thi B',
    studentCode: 'S001',
    primaryClassName: 'Ấu Nhi 1',
  },
  {
    _id: 'student2' as Id<'students'>,
    saintName: null,
    fullName: 'Le Van C',
    studentCode: 'S002',
    primaryClassName: null,
  },
]

const catechistsFixture = [
  {
    _id: 'catechist2' as Id<'catechists'>,
    saintName: 'Giuse',
    fullName: 'Pham Van D',
    memberId: 'M002',
  },
]

describe('HeaderSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders nothing when user is not a catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser({ accountType: 'student' }),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    const { container } = render(<HeaderSearch />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when user is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    const { container } = render(<HeaderSearch />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders the search input when user is a catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    render(<HeaderSearch />)

    expect(
      screen.getByPlaceholderText('header.search.placeholder'),
    ).toBeInTheDocument()
  })

  test('useOneShotQuery is called with "skip" when the query is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    render(<HeaderSearch />)

    expect(useOneShotQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
  })

  test('skips queries shorter than 2 characters', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(useOneShotQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')
  })

  test('caps the query at 100 characters', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'x'.repeat(150) } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(useOneShotQuery).toHaveBeenLastCalledWith(expect.anything(), {
      query: 'x'.repeat(100),
    })
  })

  test('debounces typed input before firing the search query', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(oneShot(undefined))

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: '  Maria  ' } })

    // Not yet debounced: the query is still skipped.
    expect(useOneShotQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(useOneShotQuery).toHaveBeenLastCalledWith(expect.anything(), {
      query: 'Maria',
    })
  })

  test('renders group labels and item labels for students and catechists', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(
      oneShot({
        students: studentsFixture,
        catechists: catechistsFixture,
      }),
    )

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('header.search.students')).toBeInTheDocument()
    expect(screen.getByText('header.search.catechists')).toBeInTheDocument()
    expect(screen.getByText('Maria Tran Thi B')).toBeInTheDocument()
    expect(screen.getByText('Le Van C')).toBeInTheDocument()
    expect(screen.getByText('Giuse Pham Van D')).toBeInTheDocument()
  })

  test('selecting a student item navigates to the student detail route', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(
      oneShot({
        students: studentsFixture,
        catechists: catechistsFixture,
      }),
    )

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const option = screen.getByText('Maria Tran Thi B')
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/students/student1' })
  })

  test('selecting a catechist item navigates to the catechist detail route', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(
      oneShot({
        students: studentsFixture,
        catechists: catechistsFixture,
      }),
    )

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const option = screen.getByText('Giuse Pham Van D')
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/catechists/catechist2' })
  })

  test('shows the empty state when there are no results', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useOneShotQuery).mockReturnValue(
      oneShot({ students: [], catechists: [] }),
    )

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'nomatch' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('common.noResultsFound')).toBeInTheDocument()
  })
})
