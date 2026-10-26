import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { StudentDetailCards } from './student-detail-cards'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatDate } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    Link: ({ children, to, params, className }: any) => (
      <a href={to} data-params={JSON.stringify(params)} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('~/components/custom/enrollment-summary', () => ({
  EnrollmentSummary: ({ studentClassId }: { studentClassId: string }) => (
    <div data-testid="enrollment-summary">{studentClassId}</div>
  ),
}))

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'student1' as Id<'students'>,
    studentCode: 1001,
    saintName: 'Maria',
    fullName: 'Nguyễn Thị A',
    dateOfBirth: '2015-05-01',
    gender: 'female',
    isActive: true,
    previousParish: 'Giáo xứ Cũ',
    previousDiocese: 'Giáo phận Cũ',
    address: {
      addressLine1: '123 Đường ABC',
      addressLine2: 'Khu phố 1',
      city: 'TP HCM',
      postalCode: '700000',
      hamlet: 'Ấp 1',
      subHamlet: 'Tổ 2',
      country: 'Việt Nam',
    },
    sacraments: [
      {
        sacramentType: 'baptism',
        receivedDate: '2015-06-01',
        receivedPlace: 'Nhà thờ Chính Tòa',
        feastName: 'Thánh Giuse',
        sponsorName: 'Nguyễn Văn D',
        notes: 'Ghi chú rửa tội',
      },
    ],
    guardians: [
      {
        _id: 'guardian1',
        relationship: 'mother',
        contactPriority: 1,
        notes: 'Ghi chú người giám hộ',
        guardian: { saintName: 'Anna', fullName: 'Trần Thị B' },
        contacts: [
          {
            _id: 'c1',
            contactType: 'phone',
            value: '0901234567',
            isPrimary: true,
          },
          {
            _id: 'c2',
            contactType: 'email',
            value: 'a@example.com',
            isPrimary: false,
          },
          {
            _id: 'c3',
            contactType: 'zalo',
            value: '0901234567',
            isPrimary: false,
          },
        ],
      },
    ],
    siblings: [
      {
        _id: 'sibling1' as Id<'students'>,
        saintName: 'Joseph',
        fullName: 'Nguyễn Văn C',
        currentClassName: 'Ấu Nhi 2',
      },
    ],
    enrollments: [
      {
        _id: 'enroll1',
        status: 'active',
        isPrimaryClass: true,
        enrolledDate: '2024-09-01',
        leftDate: null,
        classYear: {
          className: 'Ấu Nhi 1',
          academicYearName: '2024-2025',
          academicYearStartDate: '2024-09-01',
          academicYearActive: true,
        },
      },
    ],
    ...overrides,
  }
}

describe('StudentDetailCards', () => {
  describe('personal info card', () => {
    test('shows skeletons while loading', () => {
      const { container } = render(<StudentDetailCards data={undefined} />)
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThan(0)
    })

    test('shows not-found message when data is null', () => {
      render(<StudentDetailCards data={null} />)
      expect(screen.getByText('profile.personal.not_found')).toBeInTheDocument()
    })

    test('renders personal fields, formatted DOB, gender/status badges', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      expect(screen.getByText('1001')).toBeInTheDocument()
      expect(
        screen.getByText(formatPersonName('Maria', 'Nguyễn Thị A')),
      ).toBeInTheDocument()
      expect(screen.getByText(formatDate('2015-05-01'))).toBeInTheDocument()
      expect(screen.getByText('students.gender.female')).toBeInTheDocument()
      // "students.status.active" also appears on the current enrollment's
      // status badge in the enrollments card, so scope to the studentCode's
      // card to target the personal-info status badge specifically.
      const personalCard = screen
        .getByText('students.col.studentCode')
        .closest('[data-slot="card"]') as HTMLElement
      expect(
        within(personalCard).getByText('students.status.active'),
      ).toBeInTheDocument()
      expect(screen.getByText('Giáo xứ Cũ')).toBeInTheDocument()
      expect(screen.getByText('Giáo phận Cũ')).toBeInTheDocument()
    })

    test('renders inactive status badge and dashes when optional fields absent', () => {
      const data = makeData({
        isActive: false,
        gender: undefined,
        dateOfBirth: undefined,
        previousParish: undefined,
        previousDiocese: undefined,
      })
      render(<StudentDetailCards data={data as any} />)

      expect(screen.getByText('students.status.inactive')).toBeInTheDocument()
      expect(
        screen.queryByText('students.gender.female'),
      ).not.toBeInTheDocument()
    })

    test('renders full address section when address is present', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      expect(screen.getByText('123 Đường ABC')).toBeInTheDocument()
      expect(screen.getByText('Khu phố 1')).toBeInTheDocument()
      expect(screen.getByText('TP HCM')).toBeInTheDocument()
      expect(screen.getByText('700000')).toBeInTheDocument()
      expect(screen.getByText('Ấp 1')).toBeInTheDocument()
      expect(screen.getByText('Tổ 2')).toBeInTheDocument()
      expect(screen.getByText('Việt Nam')).toBeInTheDocument()
    })

    test('does not render address section when address is absent', () => {
      const data = makeData({ address: null })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.queryByText('profile.address.title'),
      ).not.toBeInTheDocument()
    })
  })

  describe('contact section', () => {
    const renderWith = (overrides: Record<string, unknown>) =>
      render(<StudentDetailCards data={makeData(overrides) as any} />)
    const getSection = () => screen.getByTestId('student-contact-section')

    test('renders phone and email as tel:/mailto: links', () => {
      renderWith({ phone: '+84901234567', email: 'a@x.com' })
      const section = getSection()
      expect(
        within(section).getByRole('link', { name: '+84901234567' }),
      ).toHaveAttribute('href', 'tel:+84901234567')
      expect(
        within(section).getByRole('link', { name: 'a@x.com' }),
      ).toHaveAttribute('href', 'mailto:a@x.com')
    })

    test('shows dash placeholders when canViewSensitive and no phone/email', () => {
      renderWith({ canViewSensitive: true })
      const section = getSection()
      expect(within(section).getAllByText('-')).toHaveLength(2)
      expect(within(section).queryByRole('link')).not.toBeInTheDocument()
    })

    test.each([[{ canViewSensitive: false }], [{}]])(
      'does not render section without access or values (%j)',
      (overrides) => {
        renderWith(overrides)
        expect(
          screen.queryByTestId('student-contact-section'),
        ).not.toBeInTheDocument()
      },
    )

    test('renders masked values as plain text, not links', () => {
      renderWith({ phone: '+84***4567', email: 'a***@x.com' })
      const section = getSection()
      expect(within(section).getByText('+84***4567')).toBeInTheDocument()
      expect(within(section).getByText('a***@x.com')).toBeInTheDocument()
      expect(within(section).queryByRole('link')).not.toBeInTheDocument()
    })

    test('is placed after personal info and before the address section', () => {
      renderWith({ phone: '+84901234567' })
      const section = getSection()
      const address = screen
        .getByText('profile.address.title')
        .closest('div.border-t') as HTMLElement
      const code = screen.getByText('students.col.studentCode')
      expect(
        code.compareDocumentPosition(section) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        section.compareDocumentPosition(address) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  describe('sacraments card', () => {
    test('shows skeletons while loading', () => {
      const { container } = render(<StudentDetailCards data={undefined} />)
      // Both personal-info and sacraments skeletons render simultaneously
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThanOrEqual(4)
    })

    test('shows no-record message when sacraments list is empty', () => {
      const data = makeData({ sacraments: [] })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText('students.sacraments.noRecord'),
      ).toBeInTheDocument()
    })

    test('renders received sacrament with default badge, date, place, notes', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      const badge = screen.getByText('students.sacraments.baptism')
      expect(badge).toHaveAttribute('data-variant', 'default')

      const card = badge.closest('[data-slot="card"]') as HTMLElement
      expect(
        within(card).getByText(formatDate('2015-06-01')),
      ).toBeInTheDocument()
      expect(within(card).getByText('Nhà thờ Chính Tòa')).toBeInTheDocument()
      expect(within(card).getByText('Ghi chú rửa tội')).toBeInTheDocument()
    })

    test('renders only received sacraments (no outline badges for unreceived)', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      // Only baptism should render (it's the only one in sacraments array)
      expect(
        screen.getByText('students.sacraments.baptism'),
      ).toBeInTheDocument()
      // Confirmation should not be in the document since it's not received
      expect(
        screen.queryByText('students.sacraments.confirmation'),
      ).not.toBeInTheDocument()
    })

    test('renders sacrament detail fields (feastName, sponsorName)', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      const badge = screen.getByText('students.sacraments.baptism')
      const card = badge.closest('[data-slot="card"]') as HTMLElement
      expect(within(card).getByText('Thánh Giuse')).toBeInTheDocument()
      expect(within(card).getByText('Nguyễn Văn D')).toBeInTheDocument()
    })
  })

  describe('guardians card', () => {
    test('shows skeletons while loading', () => {
      const { container } = render(<StudentDetailCards data={undefined} />)
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThanOrEqual(6)
    })

    test('shows no-record message when guardians list is empty', () => {
      const data = makeData({ guardians: [] })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText('students.detail.guardians.noRecord'),
      ).toBeInTheDocument()
    })

    test('renders guardian name, relationship, priority badge, contacts, and notes', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText(formatPersonName('Anna', 'Trần Thị B')),
      ).toBeInTheDocument()
      expect(screen.getByText('mother')).toBeInTheDocument()
      expect(
        screen.getByText('students.detail.guardians.contactPriority'),
      ).toBeInTheDocument()
      expect(screen.getByText('Ghi chú người giám hộ')).toBeInTheDocument()

      // ContactDeepLink integration: phone (tel:), email (mailto:), zalo (zalo.me)
      const phoneLinks = screen.getAllByText('0901234567')
      const phoneLink = phoneLinks.find(
        (el) =>
          el.tagName === 'A' && el.getAttribute('href') === 'tel:0901234567',
      )
      expect(phoneLink).toBeTruthy()
      const zaloLink = phoneLinks.find(
        (el) =>
          el.tagName === 'A' &&
          el.getAttribute('href') === 'https://zalo.me/0901234567',
      )
      expect(zaloLink).toBeTruthy()

      const emailLink = screen.getByText('a@example.com')
      expect(emailLink).toHaveAttribute('href', 'mailto:a@example.com')

      expect(screen.getByText('Zalo')).toBeInTheDocument()
      expect(screen.getByText('common.primary')).toBeInTheDocument()
    })

    test('does not render a contact list when guardian has no contacts', () => {
      const data = makeData({
        guardians: [
          {
            _id: 'guardian2',
            relationship: 'father',
            contactPriority: 2,
            notes: undefined,
            guardian: { saintName: 'Peter', fullName: 'Lê Văn D' },
            contacts: [],
          },
        ],
      })
      render(<StudentDetailCards data={data as any} />)

      expect(screen.queryByText('common.primary')).not.toBeInTheDocument()
    })

    test('renders siblings with links when present', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText('students.detail.siblings.title'),
      ).toBeInTheDocument()
      const link = screen
        .getByText(formatPersonName('Joseph', 'Nguyễn Văn C'))
        .closest('a') as HTMLAnchorElement
      expect(link).toHaveAttribute('href', '/students/$id')
      expect(link).toHaveAttribute('data-params', '{"id":"sibling1"}')
      expect(screen.getByText('Ấu Nhi 2')).toBeInTheDocument()
    })

    test('falls back to the noClass label when sibling has no current class', () => {
      const data = makeData({
        siblings: [
          {
            _id: 'sibling2' as Id<'students'>,
            saintName: 'Joseph',
            fullName: 'Nguyễn Văn E',
            currentClassName: null,
          },
        ],
      })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText('students.detail.siblings.noClass'),
      ).toBeInTheDocument()
    })

    test('does not render the siblings section when there are none', () => {
      const data = makeData({ siblings: [] })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.queryByText('students.detail.siblings.title'),
      ).not.toBeInTheDocument()
    })
  })

  describe('enrollments card', () => {
    test('shows skeletons while loading', () => {
      const { container } = render(<StudentDetailCards data={undefined} />)
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThanOrEqual(3)
    })

    test('shows no-record message when enrollments list is empty', () => {
      const data = makeData({ enrollments: [] })
      render(<StudentDetailCards data={data as any} />)

      expect(
        screen.getByText('students.enrollments.noRecord'),
      ).toBeInTheDocument()
    })

    test('renders a current active enrollment expanded with primary/status badges and mounted EnrollmentSummary', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      expect(screen.getByText('Ấu Nhi 1')).toBeInTheDocument()
      const enrollmentRow = screen
        .getByText('Ấu Nhi 1')
        .closest('li') as HTMLElement
      expect(
        within(enrollmentRow).getByText('students.detail.isPrimary'),
      ).toBeInTheDocument()
      expect(
        within(enrollmentRow).getByText('students.status.active'),
      ).toBeInTheDocument()
      expect(
        within(enrollmentRow).getByText(formatDate('2024-09-01'), {
          exact: false,
        }),
      ).toBeInTheDocument()

      // defaultOpen (isCurrent) enrollments render EnrollmentSummary mounted.
      expect(screen.getByTestId('enrollment-summary')).toHaveTextContent(
        'enroll1',
      )
    })

    test('does not mount EnrollmentSummary for a non-current (collapsed) enrollment', () => {
      const data = makeData({
        enrollments: [
          {
            _id: 'enroll2',
            status: 'withdrawn',
            isPrimaryClass: false,
            enrolledDate: '2020-09-01',
            leftDate: '2021-06-01',
            classYear: {
              className: 'Ấu Nhi Cũ',
              academicYearName: '2020-2021',
              academicYearStartDate: '2020-09-01',
              academicYearActive: false,
            },
          },
        ],
      })
      render(<StudentDetailCards data={data as any} />)

      expect(screen.queryByTestId('enrollment-summary')).not.toBeInTheDocument()
      // Status/primary badges only show for the current enrollment; withdrawn
      // history rows omit the status badge but do show the left date.
      expect(
        screen.queryByText('students.status.withdrawn'),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(formatDate('2021-06-01'), { exact: false }),
      ).toBeInTheDocument()
    })

    test('sorts enrollments by academic year start date descending', () => {
      const data = makeData({
        enrollments: [
          {
            _id: 'old',
            status: 'withdrawn',
            isPrimaryClass: false,
            enrolledDate: '2020-09-01',
            leftDate: '2021-06-01',
            classYear: {
              className: 'Old Class',
              academicYearName: '2020-2021',
              academicYearStartDate: '2020-09-01',
              academicYearActive: false,
            },
          },
          {
            _id: 'new',
            status: 'active',
            isPrimaryClass: true,
            enrolledDate: '2024-09-01',
            leftDate: null,
            classYear: {
              className: 'New Class',
              academicYearName: '2024-2025',
              academicYearStartDate: '2024-09-01',
              academicYearActive: true,
            },
          },
        ],
      })
      render(<StudentDetailCards data={data as any} />)

      const enrollmentsTab = screen.getByRole('tab', {
        name: 'students.detail.tabs.enrollments',
      })
      fireEvent.click(enrollmentsTab)

      const items = screen.getAllByRole('listitem')
      const classNames = items.map((li) => li.textContent || '')
      const newIndex = classNames.findIndex((t) => t.includes('New Class'))
      const oldIndex = classNames.findIndex((t) => t.includes('Old Class'))
      expect(newIndex).toBeLessThan(oldIndex)
    })

    test('renders on_leave status with secondary badge variant', () => {
      const data = makeData({
        enrollments: [
          {
            _id: 'enroll3',
            status: 'on_leave',
            isPrimaryClass: false,
            enrolledDate: '2024-09-01',
            leftDate: null,
            classYear: {
              className: 'Ấu Nhi 3',
              academicYearName: '2024-2025',
              academicYearStartDate: '2024-09-01',
              academicYearActive: true,
            },
          },
        ],
      })
      render(<StudentDetailCards data={data as any} />)

      const badge = screen.getByText('students.status.on_leave')
      expect(badge).toHaveAttribute('data-variant', 'secondary')
    })
  })

  describe('tabs layout and navigation', () => {
    test('renders tabs in exact order: personal info | guardians | sacraments | enrollment history', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(4)
      expect(tabs[0]).toHaveTextContent('students.detail.tabs.personal')
      expect(tabs[1]).toHaveTextContent('students.detail.tabs.guardians')
      expect(tabs[2]).toHaveTextContent('students.detail.tabs.sacraments')
      expect(tabs[3]).toHaveTextContent('students.detail.tabs.enrollments')
    })

    test('defaults to personal info tab and allows switching tabs', () => {
      const data = makeData()
      render(<StudentDetailCards data={data as any} />)

      const tabs = screen.getAllByRole('tab')
      expect(tabs[0]).toHaveAttribute('data-active', '')
      expect(screen.getByText('students.detail.personal.title')).toBeVisible()

      // Switch to guardians tab
      fireEvent.click(tabs[1])
      expect(tabs[1]).toHaveAttribute('data-active', '')
      expect(screen.getByText('students.detail.guardians.title')).toBeVisible()

      // Switch to sacraments tab
      fireEvent.click(tabs[2])
      expect(tabs[2]).toHaveAttribute('data-active', '')
      expect(screen.getByText('students.detail.sacraments.title')).toBeVisible()

      // Switch to enrollment history tab
      fireEvent.click(tabs[3])
      expect(tabs[3]).toHaveAttribute('data-active', '')
      expect(
        screen.getByText('students.detail.enrollments.title'),
      ).toBeVisible()
    })
  })
})
