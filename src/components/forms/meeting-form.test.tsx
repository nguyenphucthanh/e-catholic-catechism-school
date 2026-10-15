import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { MeetingForm } from './meeting-form'

const createMock = vi.fn()
const updateMock = vi.fn()
const onSuccess = vi.fn()
const onCancel = vi.fn()

const branches = [
  { _id: 'br-1', name: 'Ấu Nhi' },
  { _id: 'br-2', name: 'Thiếu Nhi' },
]

const existing = {
  _id: 'meet-1',
  title: 'Họp cũ',
  meetingDate: '2024-10-07',
  scope: 'branch',
  branchId: 'br-2',
  startTime: '09:00',
  endTime: '10:00',
  location: 'Hall',
  notes: 'Bring files',
} as any

function renderForm(props: Partial<Parameters<typeof MeetingForm>[0]> = {}) {
  return render(
    <MeetingForm
      requesterId={'cat-1' as any}
      academicYearId={'ay-1' as any}
      onSuccess={onSuccess}
      onCancel={onCancel}
      {...props}
    />,
  )
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function pick(trigger: HTMLElement, optionName: string) {
  fireEvent.click(trigger)
  const option = await screen.findByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

const submit = (container: HTMLElement) =>
  fireEvent.submit(container.querySelector('form')!)

describe('MeetingForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2024-10-05T08:00:00'))
    createMock.mockReset().mockResolvedValue('new-id')
    updateMock.mockReset().mockResolvedValue(null)
    onSuccess.mockReset()
    onCancel.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(useQuery).mockImplementation(((ref: any) =>
      ref?.[Symbol.for('functionName')] === 'branches:list'
        ? branches
        : undefined) as any)
    vi.mocked(useMutation).mockImplementation(((ref: any) => {
      const path = ref?.[Symbol.for('functionName')]
      if (path === 'catechistMeetings:createMeeting') return createMock
      if (path === 'catechistMeetings:updateMeeting') return updateMock
      return vi.fn()
    }) as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('create: requires a title and does not call the mutation', async () => {
    const { container } = renderForm()
    submit(container)
    expect(await screen.findByText('common.required')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  test('create: submits trimmed title, defaults and undefined optional fields', async () => {
    const { container } = renderForm()
    type(/meetings\.fields\.title/, '  Họp T10  ')
    submit(container)
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock).toHaveBeenCalledWith({
      requesterId: 'cat-1',
      academicYearId: 'ay-1',
      title: 'Họp T10',
      meetingDate: '2024-10-05',
      scope: 'all',
      branchId: undefined,
      startTime: undefined,
      endTime: undefined,
      location: undefined,
      notes: undefined,
    })
    expect(updateMock).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('common.saved')
    expect(onSuccess).toHaveBeenCalled()
  })

  test('create: sends optional fields when filled', async () => {
    const { container } = renderForm()
    type(/meetings\.fields\.title/, 'Họp')
    type(/meetings\.fields\.startTime/, '09:00')
    type(/meetings\.fields\.endTime/, '10:30')
    type(/meetings\.fields\.location/, 'Hall')
    type(/meetings\.fields\.notes/, 'Note')
    submit(container)
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: '09:00',
        endTime: '10:30',
        location: 'Hall',
        notes: 'Note',
      }),
    )
  })

  test('rejects an end time that is not after the start time', async () => {
    const { container } = renderForm()
    type(/meetings\.fields\.title/, 'Họp')
    type(/meetings\.fields\.startTime/, '10:00')
    type(/meetings\.fields\.endTime/, '10:00')
    submit(container)
    expect(
      await screen.findByText('meetings.form.endBeforeStart'),
    ).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  test('branch scope reveals the branch select and requires a branch', async () => {
    const { container } = renderForm()
    expect(screen.queryByText('meetings.fields.branch')).not.toBeInTheDocument()
    type(/meetings\.fields\.title/, 'Họp')
    await pick(screen.getAllByRole('combobox')[0], 'meetings.scope.branch')
    expect(
      await screen.findByText(/meetings\.fields\.branch$/),
    ).toBeInTheDocument()
    submit(container)
    expect(await screen.findByText('common.required')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  test('branch scope with a chosen branch submits the branchId', async () => {
    const { container } = renderForm()
    type(/meetings\.fields\.title/, 'Họp')
    await pick(screen.getAllByRole('combobox')[0], 'meetings.scope.branch')
    await pick(screen.getAllByRole('combobox')[1], 'Thiếu Nhi')
    submit(container)
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'branch', branchId: 'br-2' }),
    )
  })

  test('shows a translated error toast and stays when create fails', async () => {
    createMock.mockRejectedValue(new Error('CATECHIST_MEETING_INVALID_DATE'))
    const { container } = renderForm()
    type(/meetings\.fields\.title/, 'Họp')
    submit(container)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('meetings.errors.invalidDate'),
    )
    expect(onSuccess).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('create without an academic year does nothing', async () => {
    const { container } = renderForm({ academicYearId: undefined })
    type(/meetings\.fields\.title/, 'Họp')
    submit(container)
    await waitFor(() => expect(screen.getByText('common.save')).toBeEnabled())
    expect(createMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('edit: prefills values and shows the branch select', () => {
    renderForm({ meeting: existing, academicYearId: undefined })
    expect(screen.getByLabelText(/meetings\.fields\.title/)).toHaveValue(
      'Họp cũ',
    )
    expect(screen.getByLabelText(/meetings\.fields\.startTime/)).toHaveValue(
      '09:00',
    )
    expect(screen.getByLabelText(/meetings\.fields\.endTime/)).toHaveValue(
      '10:00',
    )
    expect(screen.getByLabelText(/meetings\.fields\.location/)).toHaveValue(
      'Hall',
    )
    expect(screen.getByLabelText(/meetings\.fields\.notes/)).toHaveValue(
      'Bring files',
    )
    expect(screen.getByText('Thiếu Nhi')).toBeInTheDocument()
  })

  test('edit: unchanged submit calls update with the existing values', async () => {
    const { container } = renderForm({ meeting: existing })
    submit(container)
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith({
      requesterId: 'cat-1',
      meetingId: 'meet-1',
      title: 'Họp cũ',
      meetingDate: '2024-10-07',
      scope: 'branch',
      branchId: 'br-2',
      startTime: '09:00',
      endTime: '10:00',
      location: 'Hall',
      notes: 'Bring files',
    })
    expect(createMock).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
  })

  test('edit: cleared optional fields are sent as empty strings', async () => {
    const { container } = renderForm({
      meeting: { ...existing, scope: 'all', branchId: undefined },
    })
    type(/meetings\.fields\.startTime/, '')
    type(/meetings\.fields\.endTime/, '')
    type(/meetings\.fields\.location/, '')
    type(/meetings\.fields\.notes/, '')
    submit(container)
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'all',
        branchId: undefined,
        startTime: '',
        endTime: '',
        location: '',
        notes: '',
      }),
    )
  })

  test('cancel leaves immediately when the form is pristine', () => {
    renderForm()
    fireEvent.click(screen.getByText('common.cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  test('cancel on a dirty form asks for confirmation; keep editing stays', async () => {
    renderForm()
    type(/meetings\.fields\.title/, 'x')
    fireEvent.click(screen.getByText('common.cancel'))
    const dialog = await screen.findByRole('alertdialog')
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(
      dialog.querySelector('[data-slot="alert-dialog-cancel"]') as HTMLElement,
    )
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
    expect(onCancel).not.toHaveBeenCalled()
  })

  test('discarding on the leave confirmation calls onCancel', async () => {
    renderForm()
    type(/meetings\.fields\.notes/, 'draft')
    fireEvent.click(screen.getByText('common.cancel'))
    fireEvent.click(await screen.findByText('meetings.confirmLeave.discard'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
