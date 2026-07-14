import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { CalendarEventDialog } from './calendar-event-dialog'
import type { Id } from '../../../convex/_generated/dataModel'
import { getLiturgicalDateLabel } from '~/lib/romcal'

// Mock Convex hooks — this component calls useQuery 3 times (myScopes,
// branches.list, classes.listClassYears) and useMutation twice
// (create, update), so branch on the resolved function path per the
// Symbol.for('functionName') pattern documented in project memory.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('~/lib/romcal', () => ({
  getLiturgicalDateLabel: vi.fn(),
}))

// RichTextEditor wraps Tiptap (already unit-tested on its own) — replace
// with a plain textarea so this dialog's tests only exercise its own
// wiring, not Tiptap/ProseMirror internals.
vi.mock('~/components/custom/richtext-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (v: string) => void
  }) => (
    <textarea
      aria-label="calendarEvents.dialog.description"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

// Mock Select as a native <select> — avoids BaseUI Select's pointerDown
// interaction quirks and keeps assertions on option lists simple.
vi.mock('~/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => {
    const [, forceUpdate] = React.useState(0)
    React.useEffect(() => {
      forceUpdate(1)
    }, [])
    return (
      <select
        data-testid="mock-select"
        value={value ?? ''}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    )
  },
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children, disabled }: any) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
}))

// Mock Dialog to render inline (avoid portal/open-state indirection).
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

describe('CalendarEventDialog', () => {
  const requesterId = 'catechist1' as Id<'catechists'>
  const academicYearId = 'year1' as Id<'academicYears'>
  const branchId = 'branch1' as Id<'branches'>
  const classYearId = 'classYear1' as Id<'classYears'>
  const mockOnOpenChange = vi.fn()

  let createMock: ReturnType<typeof vi.fn>
  let updateMock: ReturnType<typeof vi.fn>

  const adminScopes = {
    isAdmin: true,
    board: true,
    branchIds: null,
    classYearIds: null,
  }

  const restrictedScopes = {
    isAdmin: false,
    board: false,
    branchIds: [branchId],
    classYearIds: [classYearId],
  }

  const branches = [
    { _id: branchId, name: 'Ấu Nhi', sortOrder: 1, isDeleted: false },
    {
      _id: 'branch2' as Id<'branches'>,
      name: 'Thiếu Nhi',
      sortOrder: 2,
      isDeleted: false,
    },
  ]

  const classYearsList = [
    { classYearId, classId: 'class1' as Id<'classes'>, className: 'Lớp 1A' },
    {
      classYearId: 'classYear2' as Id<'classYears'>,
      classId: 'class2' as Id<'classes'>,
      className: 'Lớp 1B',
    },
  ]

  function mockQueries(scopes: unknown) {
    ;(useQuery as any).mockImplementation((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'calendarEvents:myScopes') return scopes
      if (path === 'branches:list') return branches
      if (path === 'classes:listClassYears') return classYearsList
      return undefined
    })
  }

  beforeEach(() => {
    createMock = vi.fn().mockResolvedValue('event1')
    updateMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'calendarEvents:create') return createMock as any
      if (path === 'calendarEvents:update') return updateMock as any
      return vi.fn() as any
    })
    vi.mocked(getLiturgicalDateLabel).mockResolvedValue('Some Feast Day')
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    mockOnOpenChange.mockClear()
    mockQueries(adminScopes)
  })

  test('create mode renders scope, branch, and class fields', () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.getByText('calendarEvents.dialog.scope')).toBeInTheDocument()

    // scope defaults to 'board' so branch/class Selects aren't rendered yet;
    // switch scope to 'branch' to reveal the branch Select.
    const selects = screen.getAllByTestId('mock-select')
    const scopeSelect = selects[1] // date input has no select; order: severity, scope
    fireEvent.change(scopeSelect, { target: { value: 'branch' } })

    expect(screen.getByText('calendarEvents.dialog.branch')).toBeInTheDocument()
  })

  test('create mode calls api.calendarEvents.create with expected args on submit', async () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const submitButton = screen.getByRole('button', {
      name: 'calendarEvents.dialog.create',
    })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId,
          academicYearId,
          scope: 'board',
          branchId: undefined,
          classYearId: undefined,
          severity: 'medium',
        }),
      )
      expect(toast.success).toHaveBeenCalledWith(
        'calendarEvents.dialog.createSuccess',
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('edit mode hides scope, branch, and class fields', () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
        event={
          {
            _id: 'event1' as Id<'calendarEvents'>,
            date: '2024-12-25',
            liturgicalDate: 'Christmas',
            description: 'desc',
            severity: 'medium',
            scope: 'board',
          } as any
        }
      />,
    )

    expect(
      screen.queryByText('calendarEvents.dialog.scope'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('calendarEvents.dialog.branch'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('calendarEvents.dialog.classYear'),
    ).not.toBeInTheDocument()
  })

  test('edit mode calls api.calendarEvents.update with expected args on submit', async () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
        event={
          {
            _id: 'event1' as Id<'calendarEvents'>,
            date: '2024-12-25',
            liturgicalDate: 'Christmas',
            description: 'desc',
            severity: 'medium',
            scope: 'board',
          } as any
        }
      />,
    )

    const submitButton = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId,
          id: 'event1',
          date: '2024-12-25',
          liturgicalDate: 'Christmas',
          description: 'desc',
          severity: 'medium',
        }),
      )
      expect(toast.success).toHaveBeenCalledWith(
        'calendarEvents.dialog.updateSuccess',
      )
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  test('liturgical date auto-populates on date change until manually edited', async () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const dateInput = screen.getByLabelText(/calendarEvents.dialog.date/)
    fireEvent.change(dateInput, { target: { value: '2024-12-25' } })

    await waitFor(() => {
      expect(getLiturgicalDateLabel).toHaveBeenCalledWith(
        '2024-12-25',
        expect.any(Object),
      )
    })
    const liturgicalInput: HTMLInputElement = screen.getByLabelText(
      'calendarEvents.dialog.liturgicalDate',
    )
    await waitFor(() => {
      expect(liturgicalInput.value).toBe('Some Feast Day')
    })

    // manually edit the liturgical date field
    fireEvent.change(liturgicalInput, { target: { value: 'Custom Label' } })
    expect(liturgicalInput.value).toBe('Custom Label')

    // changing the date again should no longer overwrite the manual edit
    vi.mocked(getLiturgicalDateLabel).mockClear()
    fireEvent.change(dateInput, { target: { value: '2024-01-01' } })

    await waitFor(() => {
      // getLiturgicalDateLabel is still called (component always looks it
      // up), but the field is no longer overwritten because it's touched
      expect(liturgicalInput.value).toBe('Custom Label')
    })
  })

  test('branch/class select options are filtered by myScopes: admin sees all branches', () => {
    mockQueries(adminScopes)
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const selects = screen.getAllByTestId('mock-select')
    const scopeSelect = selects[1]
    fireEvent.change(scopeSelect, { target: { value: 'branch' } })

    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.getByText('Thiếu Nhi')).toBeInTheDocument()
  })

  test('branch/class select options are filtered by myScopes: non-admin sees only their permitted branch', () => {
    mockQueries(restrictedScopes)
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const selects = screen.getAllByTestId('mock-select')
    const scopeSelect = selects[1]
    fireEvent.change(scopeSelect, { target: { value: 'branch' } })

    expect(screen.getByText('Ấu Nhi')).toBeInTheDocument()
    expect(screen.queryByText('Thiếu Nhi')).not.toBeInTheDocument()
  })

  test('branch/class select options are filtered by myScopes: non-admin sees only their permitted class', () => {
    mockQueries(restrictedScopes)
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    const selects = screen.getAllByTestId('mock-select')
    const scopeSelect = selects[1]
    fireEvent.change(scopeSelect, { target: { value: 'class' } })

    expect(screen.getByText('Lớp 1A')).toBeInTheDocument()
    expect(screen.queryByText('Lớp 1B')).not.toBeInTheDocument()
  })

  test('cancel button closes the dialog without submitting', () => {
    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    fireEvent.click(screen.getByText('common.cancel'))

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  test('shows an error toast when the mutation fails', async () => {
    createMock.mockRejectedValueOnce(new Error('CALENDAR_EVENT_UNAUTHORIZED'))

    render(
      <CalendarEventDialog
        isOpen
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'calendarEvents.dialog.create' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'errors.calendarEventUnauthorized',
      )
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })
  })

  test('does not render when isOpen is false', () => {
    render(
      <CalendarEventDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        requesterId={requesterId}
        academicYearId={academicYearId}
      />,
    )

    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument()
  })
})
