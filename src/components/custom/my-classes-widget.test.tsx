import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { MyClassesWidget } from './my-classes-widget'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, search, className }: any) => (
      <a
        href={to}
        data-params={JSON.stringify(params)}
        data-search={JSON.stringify(search)}
        className={className}
      >
        {children}
      </a>
    ),
  }
})

const requesterId = 'catechist1' as Id<'catechists'>
const academicYearId = 'year1' as Id<'academicYears'>

const classesFixture = [
  {
    classId: 'class1' as Id<'classes'>,
    className: 'Ấu Nhi 1',
    role: 'homeroom' as const,
    studentCount: 20,
    branchName: 'Ấu Nhi',
  },
  {
    classId: 'class2' as Id<'classes'>,
    className: 'Thiếu Nhi 1',
    role: null,
    studentCount: 15,
    branchName: '',
  },
]

function getCard(className: string) {
  return screen.getByText(className).closest('.rounded-lg') as HTMLElement
}

describe('MyClassesWidget', () => {
  test('shows 3 skeleton placeholders while the query is pending', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { container } = render(
      <MyClassesWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  test('shows the empty state when there are no classes', () => {
    vi.mocked(useQuery).mockReturnValue([])

    render(
      <MyClassesWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('dashboard.myClasses.empty')).toBeInTheDocument()
  })

  test('skips the query when academicYearId is null', () => {
    vi.mocked(useQuery).mockReturnValue(undefined)

    render(<MyClassesWidget requesterId={requesterId} academicYearId={null} />)

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    // A skipped query returns `undefined`, so the widget stays in its
    // loading state rather than rendering the empty-state message.
    expect(
      screen.queryByText('dashboard.myClasses.empty'),
    ).not.toBeInTheDocument()
  })

  test('renders a card per class with role badge, branch name, student count, and both links', () => {
    vi.mocked(useQuery).mockReturnValue(classesFixture)

    render(
      <MyClassesWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const card1 = getCard('Ấu Nhi 1')
    expect(
      within(card1).getByText('classes.detail.catechists.homeroom'),
    ).toBeInTheDocument()
    expect(within(card1).getByText('Ấu Nhi')).toBeInTheDocument()
    expect(
      within(card1).getByText('dashboard.myClasses.studentCount'),
    ).toBeInTheDocument()

    const viewDetailsLink1 = within(card1)
      .getByText('dashboard.myClasses.viewDetails')
      .closest('a') as HTMLAnchorElement
    const attendanceLink1 = within(card1)
      .getByText('dashboard.myClasses.takeAttendance')
      .closest('a') as HTMLAnchorElement

    expect(viewDetailsLink1).toHaveAttribute('data-params', '{"id":"class1"}')
    expect(attendanceLink1).toHaveAttribute('data-params', '{"id":"class1"}')

    // The attendance link carries a `tab=attendance` search param; the
    // view-details link must not.
    expect(viewDetailsLink1).not.toHaveAttribute('data-search')
    expect(attendanceLink1).toHaveAttribute(
      'data-search',
      '{"tab":"attendance"}',
    )
    expect(attendanceLink1.getAttribute('data-search')).not.toBe(
      viewDetailsLink1.getAttribute('data-search'),
    )
  })

  test('does not render a role badge when role is null (branch-head-only access) and hides an empty branch name', () => {
    vi.mocked(useQuery).mockReturnValue(classesFixture)

    render(
      <MyClassesWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const card2 = getCard('Thiếu Nhi 1')
    expect(
      within(card2).queryByText('classes.detail.catechists.homeroom'),
    ).not.toBeInTheDocument()
    expect(
      within(card2).queryByText('classes.detail.catechists.coTeacher'),
    ).not.toBeInTheDocument()

    // No non-empty branch name paragraph should be rendered for this class.
    expect(within(card2).queryByText('Ấu Nhi')).not.toBeInTheDocument()
  })

  test('renders the co_teacher badge label for co_teacher role', () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        classId: 'class3' as Id<'classes'>,
        className: 'Thiếu Nhi 2',
        role: 'co_teacher' as const,
        studentCount: 10,
        branchName: 'Thiếu Nhi',
      },
    ])

    render(
      <MyClassesWidget
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const card = getCard('Thiếu Nhi 2')
    expect(
      within(card).getByText('classes.detail.catechists.coTeacher'),
    ).toBeInTheDocument()
  })
})
