import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './classes_.bulk-create'
import { useAuth } from '~/lib/auth'

vi.mock('~/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="mock-select"
      value={value || ''}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.mocked((toast as any).info).mockClear()
})

const mockBoardUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Board User',
  role: 'admin',
} as any

const mockCatechistUser = {
  ...mockBoardUser,
  role: 'user',
}

const sampleBranches = [
  {
    _id: 'branch1',
    name: 'Ấu Nhi',
    sortOrder: 1,
    description: '',
    isDeleted: false,
  },
  {
    _id: 'branch2',
    name: 'Thiếu Nhi',
    sortOrder: 2,
    description: '',
    isDeleted: false,
  },
]

function setupQueries(
  branches?: Array<any> | undefined,
  academicYears?: Array<any> | undefined,
  classes?: Array<any> | undefined,
) {
  const b = arguments.length > 0 ? branches : sampleBranches
  const ay = academicYears !== undefined ? academicYears : []
  const cls = classes !== undefined ? classes : []
  vi.mocked(useQuery).mockImplementation((queryRef: any, args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'branches:list') return b
    if (path === 'academicYears:list') return ay
    if (path === 'classes:list') {
      if (args?.academicYearId && args.academicYearId !== 'skip') {
        return cls
      }
      return []
    }
    return undefined
  })
}

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: () => ({
    selectedYearId: 'year123',
    setSelectedYearId: vi.fn(),
  }),
}))

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  const React = await import('react')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: vi.fn(({ to, children, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
    ),
  }
})

describe('BulkCreateClassesPage component', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  test('renders unauthorized message for non-board user', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    expect(screen.getByText(/common\.contactAdmin/i)).toBeInTheDocument()
  })

  test('renders loading state when branches are undefined', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries(undefined)

    const BulkCreateComponent = (Route as any).options.component
    const { container } = render(<BulkCreateComponent />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  test('renders no branch warning when branches are empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries([])

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    expect(screen.getByText('classes.noBranch.title')).toBeInTheDocument()
  })

  test('renders form with branches and allows adding/removing rows', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Should render branch names
    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.getByText('Thiếu Nhi')).toBeInTheDocument()

    // Each branch starts with 1 empty input
    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputs).toHaveLength(2)

    // Add row to first branch (Ấu Nhi)
    const addButtons = screen.getAllByRole('button', {
      name: 'classes.bulkCreate.addRow',
    })
    expect(addButtons).toHaveLength(2)
    fireEvent.click(addButtons[0]) // Add to Ấu Nhi

    const inputsAfterAdd = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputsAfterAdd).toHaveLength(3)

    // Remove row from first branch
    const removeButtons = screen.getAllByRole('button', {
      name: 'classes.bulkCreate.removeRow',
    })
    fireEvent.click(removeButtons[0]) // Remove first row of Ấu Nhi

    const inputsAfterRemove = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    expect(inputsAfterRemove).toHaveLength(2)
  })

  test('prevents submission if all inputs are empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()
    const mockCreate = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Try to submit with default empty inputs
    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('classes.bulkCreate.emptyName')
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('calls bulkCreateMutation and redirects on success', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupQueries()

    const mockCreate = vi.fn().mockResolvedValue(['id1', 'id2'])
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } }) // Ấu Nhi
    fireEvent.change(inputs[1], { target: { value: 'Class 2' } }) // Thiếu Nhi

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'catechist123',
          academicYearId: 'year123',
          classes: [
            { branchId: 'branch1', name: 'Class 1', classType: 'primary' },
            { branchId: 'branch2', name: 'Class 2', classType: 'primary' },
          ],
        }),
      )
    })
    // toast doesn't accept object directly, it checks it differently. Just verify it's called
    expect(toast.success).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
  })

  test('includes selected classType per row in bulkCreateMutation call', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { ...mockBoardUser, userDocId: 'catechist123' },
    })
    setupQueries()

    const mockCreate = vi.fn().mockResolvedValue(['id1'])
    vi.mocked(useMutation).mockReturnValue(mockCreate as any)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } })

    // First branch row has no importFromYear select rendered (previousYears
    // is empty), so mock-selects here are the per-row classType selects.
    const classTypeSelects = screen.getAllByTestId('mock-select')
    fireEvent.change(classTypeSelects[0], { target: { value: 'apostle' } })

    fireEvent.click(
      screen.getByRole('button', { name: 'classes.bulkCreate.submit' }),
    )

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          classes: expect.arrayContaining([
            expect.objectContaining({
              branchId: 'branch1',
              name: 'Class 1',
              classType: 'apostle',
            }),
          ]),
        }),
      )
    })
  })

  test('shows dirty form dialog when clicking cancel with dirty state', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })
    setupQueries()

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // Make form dirty
    const inputs = screen.getAllByPlaceholderText(
      'classes.fields.name.placeholder',
    )
    fireEvent.change(inputs[0], { target: { value: 'Class 1' } })

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(screen.getByText('classes.confirmLeave.title')).toBeInTheDocument()
    })

    // Confirm discard
    fireEvent.click(
      screen.getByRole('button', { name: 'classes.confirmLeave.discard' }),
    )

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/classes' })
    })
  })

  test('lists previous academic years and populates classes on selection', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockBoardUser,
    })

    const previousYears = [
      {
        _id: 'year123',
        name: 'Năm học 2023-2024 (Active)',
        isActive: true,
        isDeleted: false,
      },
      {
        _id: 'year122',
        name: 'Năm học 2022-2023',
        isActive: false,
        isDeleted: false,
      },
    ]

    const mockClasses = [
      {
        _id: 'c1',
        name: 'Ấu Nhi 1 Import',
        branchId: 'branch1',
        classType: 'apostle',
        isDeleted: false,
      },
      {
        _id: 'c2',
        name: 'Thiếu Nhi 1 Import',
        branchId: 'branch2',
        // legacy row with no classType — should default to 'primary'
        isDeleted: false,
      },
    ]

    setupQueries(sampleBranches, previousYears, mockClasses)

    const BulkCreateComponent = (Route as any).options.component
    render(<BulkCreateComponent />)

    // The dropdown label should be rendered
    expect(
      screen.getByText('classes.bulkCreate.importFromYear'),
    ).toBeInTheDocument()

    // The import-from-year select is the first mock-select on the page
    // (rendered before the per-branch classType selects).
    const select = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(select, { target: { value: 'year122' } })

    // Wait for the effect to trigger and populate inputs
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText(
        'classes.fields.name.placeholder',
      )
      // Since it overwrites, there should be exactly two inputs with the imported class names:
      // 'Ấu Nhi 1 Import' and 'Thiếu Nhi 1 Import'
      expect(inputs[0]).toHaveValue('Ấu Nhi 1 Import')
      expect(inputs[1]).toHaveValue('Thiếu Nhi 1 Import')
    })

    // classType carried over from import ('apostle'), defaulting to
    // 'primary' for the legacy row with no classType.
    const classTypeSelectsAfterImport = screen.getAllByTestId('mock-select')
    expect(classTypeSelectsAfterImport[1]).toHaveValue('apostle')
    expect(classTypeSelectsAfterImport[2]).toHaveValue('primary')

    expect((toast as any).info).toHaveBeenCalledWith(
      'classes.bulkCreate.imported',
    )
  })
})
