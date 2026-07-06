import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { HeaderSearch } from './header-search'
import type { Id } from '../../convex/_generated/dataModel'
import type { AuthUser } from '~/lib/auth'
import { useAuth } from '~/lib/auth'

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
    ...overrides,
  }
}

const studentsFixture = [
  {
    _id: 'student1' as Id<'students'>,
    saintName: 'Maria',
    fullName: 'Tran Thi B',
    studentCode: 'S001',
  },
  {
    _id: 'student2' as Id<'students'>,
    saintName: null,
    fullName: 'Le Van C',
    studentCode: 'S002',
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
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(<HeaderSearch />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when user is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(<HeaderSearch />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders the search input when user is a catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<HeaderSearch />)

    expect(
      screen.getByPlaceholderText('header.search.placeholder'),
    ).toBeInTheDocument()
  })

  test('useQuery is called with "skip" when the query is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<HeaderSearch />)

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
  })

  test('debounces typed input before firing the search query', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: '  Maria  ' } })

    // Not yet debounced: the query is still skipped.
    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
      requesterId: 'catechist1',
      query: 'Maria',
    })
  })

  test('renders group labels and item labels for students and catechists', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue({
      students: studentsFixture,
      catechists: catechistsFixture,
    })

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('header.search.students')).toBeInTheDocument()
    expect(screen.getByText('header.search.catechists')).toBeInTheDocument()
    expect(screen.getByText('Maria Tran Thi B (S001)')).toBeInTheDocument()
    expect(screen.getByText('Le Van C (S002)')).toBeInTheDocument()
    expect(screen.getByText('Giuse Pham Van D (M002)')).toBeInTheDocument()
  })

  test('selecting a student item navigates to the student detail route', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(useQuery).mockReturnValue({
      students: studentsFixture,
      catechists: catechistsFixture,
    })

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const option = screen.getByText('Maria Tran Thi B (S001)')
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
    vi.mocked(useQuery).mockReturnValue({
      students: studentsFixture,
      catechists: catechistsFixture,
    })

    render(<HeaderSearch />)

    const input = screen.getByPlaceholderText('header.search.placeholder')
    fireEvent.mouseDown(input)
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const option = screen.getByText('Giuse Pham Van D (M002)')
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
    vi.mocked(useQuery).mockReturnValue({ students: [], catechists: [] })

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
