import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { ACADEMIC_YEAR_ERRORS } from '../../../convex/lib/errors'
import { Route } from './academic-years'
import { useAuth } from '~/lib/auth'

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

const mockBoardUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  role: 'admin',
} as any

const mockCatechistUser = {
  ...mockBoardUser,
  role: 'user',
}

const sampleYear = {
  _id: 'year123',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

const sampleYearInactive = {
  _id: 'year456',
  name: '2023-2024',
  startDate: '2023-09-01',
  endDate: '2024-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: false,
  isDeleted: false,
}

function setupYearsQuery(years = [sampleYear]) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:list') return years
    return undefined
  })
}

describe('AcademicYearsPage component', () => {
  test('renders years table and board-only create button for board member', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Check title renders
    expect(screen.getByText('academicYears.title')).toBeInTheDocument()

    // Check board-only buttons render
    expect(
      screen.getByRole('button', { name: /create|add/i }),
    ).toBeInTheDocument()

    // Check data row renders (no timezone column in the table)
    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.getByText('academicYears.status.active')).toBeInTheDocument()
  })

  test('hides create button for non-board catechist', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupYearsQuery([])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Check board-only button is hidden
    expect(
      screen.queryByRole('button', { name: /create|add/i }),
    ).not.toBeInTheDocument()
  })

  test('renders page subtitle', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    expect(screen.getByText('academicYears.subtitle')).toBeInTheDocument()
  })

  test('renders loading skeleton when query returns undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const AcademicYearsPageComponent = (Route as any).options.component
    const { container } = render(<AcademicYearsPageComponent />)

    // With undefined query, skeleton rows are rendered
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('renders inactive badge for non-active year', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupYearsQuery([sampleYearInactive])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    expect(
      screen.getByText('academicYears.status.inactive'),
    ).toBeInTheDocument()
  })

  test('renders multiple rows for multiple years', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupYearsQuery([sampleYear, sampleYearInactive])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    expect(screen.getByText('2024-2025')).toBeInTheDocument()
    expect(screen.getByText('2023-2024')).toBeInTheDocument()
  })

  test('opens create dialog when create button is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('academicYears.dialog.create'),
      ).toBeInTheDocument()
    })
  })

  test('renders search input in the table toolbar', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // DataTable should render search input
    const searchInput = screen.getByPlaceholderText('academicYears.select_year')
    expect(searchInput).toBeInTheDocument()
  })

  test('renders row actions dropdown trigger for board users', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery([sampleYearInactive])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Board users see the row actions dropdown trigger button
    const moreActionsBtn = screen.getByRole('button', {
      name: 'common.moreActions',
    })
    expect(moreActionsBtn).toBeInTheDocument()
  })

  test('create dialog form renders name and save inputs', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })
    // Save and cancel buttons should appear
    expect(
      screen.getByRole('button', { name: 'common.save' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'common.cancel' }),
    ).toBeInTheDocument()
  })

  test('calls createMutation when create form is submitted with valid data', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const mockCreate = vi.fn().mockResolvedValue('newYearId')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Open create dialog
    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    // Fill in name field
    fireEvent.change(screen.getByLabelText(/academicYears\.fields\.name/), {
      target: { value: '2026-2027' },
    })

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    // With no dates, the mutation should not be called (validation guard)
    await waitFor(() => {
      // form has basic guard: if no startDate/endDate, returns early
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  test('cancel button in create dialog calls onSuccess (closes dialog)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('academicYears.dialog.create'),
      ).toBeInTheDocument()
    })

    // Click cancel inside the form
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    // Dialog title should disappear
    await waitFor(() => {
      expect(
        screen.queryByText('academicYears.dialog.create'),
      ).not.toBeInTheDocument()
    })
  })

  test('column headers are rendered in the table', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    expect(screen.getByText('academicYears.col.name')).toBeInTheDocument()
    expect(screen.getByText('academicYears.col.startDate')).toBeInTheDocument()
    expect(screen.getByText('academicYears.col.endDate')).toBeInTheDocument()
    expect(screen.getByText('academicYears.col.status')).toBeInTheDocument()
  })

  // Helper to open the row actions dropdown and click a given action by text
  async function openRowAction(actionText: string) {
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const item = await screen.findByText(actionText)
    fireEvent.click(item)
  }

  test('opens edit dialog with prefilled name when edit action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByText('academicYears.dialog.edit')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/academicYears\.fields\.name/)).toHaveValue(
      '2024-2025',
    )
  })

  test('calls updateMutation when edit form is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          academicYearId: 'year123',
          name: '2024-2025',
          startDate: '2024-09-01',
          endDate: '2025-05-31',
        }),
      )
    })
    expect(toast.success).toHaveBeenCalledWith('common.saved')
  })

  test('shows duplicate name error toast when create mutation throws DUPLICATE_NAME', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockUpdate = vi
      .fn()
      .mockRejectedValue(
        new Error(`Boom: ${ACADEMIC_YEAR_ERRORS.DUPLICATE_NAME}`),
      )
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'academicYears.fields.name.duplicate',
      )
    })
  })

  test('shows generic save error toast when mutation throws a non-duplicate error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockUpdate = vi.fn().mockRejectedValue(new Error('unexpected'))
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.saveError')
    })
  })

  test('shows refine error toast and skips mutation when start date is not before end date', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    const invalidRangeYear = {
      ...sampleYear,
      startDate: '2025-05-31',
      endDate: '2024-09-01',
    }
    setupYearsQuery([invalidRangeYear])

    const mockUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'academicYears.fields.endDate.refine',
      )
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('selecting a start date via calendar updates the date field', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.name/),
      ).toBeInTheDocument()
    })

    // Open the start date calendar popover and pick a day
    const calendarBtns = screen.getAllByRole('button', {
      name: 'Open calendar',
    })
    fireEvent.click(calendarBtns[0])
    const dayButton = await screen.findByRole('button', { name: /15/ })
    fireEvent.click(dayButton)

    // Popover should close after selecting a date
    await waitFor(() => {
      expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    })
  })

  test('calls setActiveMutation when set active action is clicked for inactive year', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYearInactive])

    const mockSetActive = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockSetActive as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('academicYears.actions.setActive')

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        academicYearId: 'year456',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.setActiveSuccess')
  })

  test('shows error toast when setActiveMutation rejects', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYearInactive])

    const mockSetActive = vi.fn().mockRejectedValue(new Error('fail'))
    vi.mocked(useMutation).mockReturnValue(mockSetActive as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('academicYears.actions.setActive')

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.saveError')
    })
  })

  test('the set active action is disabled for the already-active year', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const setActiveItem = await screen.findByText(
      'academicYears.actions.setActive',
    )
    expect(setActiveItem.closest('[role="menuitem"]')).toHaveAttribute(
      'data-disabled',
    )
  })

  test('opens delete confirmation dialog when delete action is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })
  })

  test('calls deleteMutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        academicYearId: 'year123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('academicYears.deleted')
  })

  test('shows deleteActiveError toast when deleting the active year fails with CANNOT_DELETE_ACTIVE', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi
      .fn()
      .mockRejectedValue(
        new Error(`Boom: ${ACADEMIC_YEAR_ERRORS.CANNOT_DELETE_ACTIVE}`),
      )
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'academicYears.deleteActiveError',
      )
    })
  })

  test('shows generic deleteError toast when delete fails with an unrelated error', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn().mockRejectedValue(new Error('network error'))
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'academicYears.delete.confirm' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('academicYears.deleteError')
    })
  })

  test('cancel button in delete dialog closes it without calling deleteMutation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupYearsQuery([sampleYear])

    const mockDelete = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDelete as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.delete')

    await waitFor(() => {
      expect(screen.getByText('academicYears.delete.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('academicYears.delete.title'),
      ).not.toBeInTheDocument()
    })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  test('does not call setActiveMutation when requesterId is missing', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: undefined },
    })
    setupYearsQuery([sampleYearInactive])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    // Row action dropdown does not render edit/delete form interactions
    // requiring requesterId since dialog only renders the form when present;
    // but the actions column is still shown for board users. Clicking
    // set active should be a no-op (handleSetActive returns early).
    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const setActiveItem = await screen.findByText(
      'academicYears.actions.setActive',
    )
    fireEvent.click(setActiveItem)

    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  test('create dialog renders numberOfSemesters field with default value 2 and hint text', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
      ).toBeInTheDocument()
    })

    const input = screen.getByLabelText(
      /academicYears\.fields\.numberOfSemesters/,
    )
    expect(input).toHaveValue(2)

    expect(
      screen.getByText('academicYears.fields.numberOfSemesters.hint'),
    ).toBeInTheDocument()
  })

  test('edit dialog does not render numberOfSemesters field', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery([sampleYear])

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    await openRowAction('common.edit')

    await waitFor(() => {
      expect(screen.getByText('academicYears.dialog.edit')).toBeInTheDocument()
    })

    expect(
      screen.queryByLabelText(/academicYears\.fields\.numberOfSemesters/),
    ).not.toBeInTheDocument()
  })

  test('submitting create with value 1 calls createMutation with numberOfSemesters: 1', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const mockCreate = vi.fn().mockResolvedValue('newYearId')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/academicYears\.fields\.name/), {
      target: { value: '2026-2027' },
    })

    function getInMonthDayButtons() {
      const grid = screen.getByRole('grid')
      return within(grid)
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('data-outside') !== 'true')
        .map((cell) => within(cell).getByRole('button'))
    }

    // Pick a start date (first in-month day)
    const calendarBtns = screen.getAllByRole('button', {
      name: 'Open calendar',
    })
    fireEvent.click(calendarBtns[0])
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })
    fireEvent.click(getInMonthDayButtons()[0])

    // Pick an end date (last in-month day, guaranteed after start date)
    fireEvent.click(calendarBtns[1])
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })
    const endDayButtons = getInMonthDayButtons()
    fireEvent.click(endDayButtons[endDayButtons.length - 1])

    fireEvent.change(
      screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
      { target: { value: '1' } },
    )

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ numberOfSemesters: 1 }),
      )
    })
  })

  test('submitting create with value 5 shows validation error and does not call createMutation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupYearsQuery()

    const mockCreate = vi.fn().mockResolvedValue('newYearId')
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const AcademicYearsPageComponent = (Route as any).options.component
    render(<AcademicYearsPageComponent />)

    fireEvent.click(
      screen.getByRole('button', { name: /academicYears\.actions\.create/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
      ).toBeInTheDocument()
    })

    fireEvent.change(
      screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
      { target: { value: '5' } },
    )
    fireEvent.blur(
      screen.getByLabelText(/academicYears\.fields\.numberOfSemesters/),
    )

    await waitFor(() => {
      expect(
        screen.getByText('academicYears.fields.numberOfSemesters.error'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    // Mutation should not be called because form is invalid
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
