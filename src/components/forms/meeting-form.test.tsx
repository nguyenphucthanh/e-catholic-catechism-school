import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { MeetingForm } from './meeting-form'

let scanHandler: ((code: string) => void) | undefined
vi.mock('~/components/custom/qr-scanner', () => ({
  QRScanner: ({ onScan }: { onScan: (c: string) => void }) => {
    scanHandler = onScan
    return <div data-testid="qr-scanner" />
  },
}))
vi.mock('~/lib/beep', () => ({ playBeep: vi.fn() }))

const createMock = vi.fn()
const updateMock = vi.fn()
const onSuccess = vi.fn()
const onCancel = vi.fn()

const branches = [
  { _id: 'br-1', name: 'Ấu Nhi' },
  { _id: 'br-2', name: 'Thiếu Nhi' },
]

const person = (id: string, n: number, name: string) => ({
  _id: id,
  catechistId: id,
  memberId: `GLV${n}`,
  fullName: name,
  saintName: undefined as string | undefined,
})
const c1 = { ...person('c1', 1, 'An'), saintName: 'Anna' }
const c2 = person('c2', 2, 'Binh')
const c3 = person('c3', 3, 'Cuong')
const c4 = person('c4', 4, 'Dung')
const allActiveList = [c1, c2, c3, c4]

// Per-test query data; values may be a function of the query args.
let data: Record<string, any> = {}

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
    scanHandler = undefined
    data = {}
    vi.mocked(useQuery).mockImplementation(((ref: any, args: any) => {
      const name = ref?.[Symbol.for('functionName')]
      if (name === 'branches:list') return branches
      if (args === 'skip') return undefined
      const d = data[name]
      return typeof d === 'function' ? d(args) : d
    }) as any)
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
      attendance: [],
    })
    expect(updateMock).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('common.saved')
    expect(onSuccess).toHaveBeenCalled()
  })

  test('create: title field lives in the form whose submit button is the bottom-bar Save (Enter-to-submit wiring)', async () => {
    // jsdom has no implicit Enter submission without user-event; assert the wiring + submit via the button.
    data['catechistMeetings:getExpectedAttendees'] = []
    const { container } = renderForm()
    const form = container.querySelector('form')!
    expect(form).toHaveAttribute('id', 'meeting-form')
    expect(form).toContainElement(
      screen.getByLabelText(/meetings\.fields\.title/),
    )
    const saveBtn = screen.getByText('common.save').closest('button')!
    expect(saveBtn).toHaveAttribute('type', 'submit')
    expect(saveBtn).toHaveAttribute('form', 'meeting-form')
    type(/meetings\.fields\.title/, 'Họp Enter')
    fireEvent.click(saveBtn)
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Họp Enter', attendance: [] }),
    )
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
      attendance: [],
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

  describe('attendance', () => {
    const EXPECTED = 'catechistMeetings:getExpectedAttendees'
    const SAVED = 'catechistAttendance:getMeetingAttendanceRoster'
    const ALL = 'catechists:listAllActive'

    const tile = (
      c: { catechistId?: string; _id: string },
      container: HTMLElement,
    ) => container.querySelector<HTMLElement>(`#catechist-${c._id}`)!

    function setStatus(el: HTMLElement, status: string) {
      fireEvent.click(el.querySelector('button')!)
      fireEvent.click(within(el).getByText(`attendance.status.${status}.short`))
    }

    const sentAttendance = (mock: typeof createMock) =>
      Object.fromEntries(
        (mock.mock.calls[0][0].attendance as Array<any>).map((a) => [
          a.catechistId,
          a,
        ]),
      )

    const save = async (mock: typeof createMock) => {
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(mock).toHaveBeenCalledTimes(1))
    }

    const openScan = () =>
      fireEvent.click(screen.getByText('attendance.createSession.scanStart'))
    const scan = (memberId: string, kind = 'catechist') =>
      act(() => {
        scanHandler!(JSON.stringify({ type: kind, memberId }))
      })
    const closeScan = async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      await waitFor(() =>
        expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument(),
      )
    }

    const extrasInput = () =>
      screen.getByPlaceholderText('meetings.attendance.extraPlaceholder')
    async function addExtra(name: RegExp) {
      fireEvent.mouseDown(extrasInput())
      const opt = await screen.findByText(name)
      fireEvent.pointerDown(opt)
      fireEvent.click(opt)
    }

    beforeEach(() => {
      data = {
        [EXPECTED]: [c1, c2],
        [ALL]: allActiveList,
      }
    })

    test('shows one tile per expected catechist', () => {
      const { container } = renderForm()
      expect(container.querySelectorAll('[id^="catechist-"]')).toHaveLength(2)
      expect(screen.getByText('Binh')).toBeInTheDocument()
      expect(screen.getByText('GLV1')).toBeInTheDocument()
    })

    test('queries the roster with scope all and no branch', () => {
      renderForm()
      expect(useQuery).toHaveBeenCalledWith(expect.anything(), {
        requesterId: 'cat-1',
        academicYearId: 'ay-1',
        scope: 'all',
        branchId: undefined,
      })
    })

    test('branch scope without a chosen branch asks to pick one and skips the query', async () => {
      renderForm()
      await pick(screen.getAllByRole('combobox')[0], 'meetings.scope.branch')
      expect(
        await screen.findByText('meetings.attendance.selectBranch'),
      ).toBeInTheDocument()
      expect(document.querySelectorAll('[id^="catechist-"]')).toHaveLength(0)
      expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')
    })

    test('branch scope shows the chosen branch roster', async () => {
      data[EXPECTED] = (a: any) => (a.branchId === 'br-1' ? [c3] : [c1, c2])
      const { container } = renderForm()
      await pick(screen.getAllByRole('combobox')[0], 'meetings.scope.branch')
      await pick(screen.getAllByRole('combobox')[1], 'Ấu Nhi')
      await waitFor(() =>
        expect(container.querySelectorAll('[id^="catechist-"]')).toHaveLength(
          1,
        ),
      )
      expect(screen.getByText('Cuong')).toBeInTheDocument()
    })

    test('empty roster shows the empty message and disables scanning', () => {
      data[EXPECTED] = []
      renderForm()
      expect(screen.getByText('meetings.attendance.empty')).toBeInTheDocument()
      expect(
        screen
          .getByText('attendance.createSession.scanStart')
          .closest('button'),
      ).toBeDisabled()
    })

    test('Save is disabled and loading shown while the roster loads', () => {
      data[EXPECTED] = undefined
      renderForm()
      expect(screen.getByText('common.loading')).toBeInTheDocument()
      expect(screen.getByText('common.save').closest('button')).toBeDisabled()
    })

    test('edit: Save stays disabled until saved attendance has loaded', () => {
      data[SAVED] = undefined
      renderForm({ meeting: existing })
      expect(screen.getByText('common.save').closest('button')).toBeDisabled()
    })

    test('create: default payload marks every roster member present', async () => {
      renderForm()
      type(/meetings\.fields\.title/, 'Họp')
      await save(createMock)
      expect(createMock.mock.calls[0][0].attendance).toEqual([
        { catechistId: 'c1', status: 'present', notes: undefined },
        { catechistId: 'c2', status: 'present', notes: undefined },
      ])
    })

    test('changing a tile status is sent in the payload', async () => {
      const { container } = renderForm()
      type(/meetings\.fields\.title/, 'Họp')
      setStatus(tile(c2, container), 'late')
      await save(createMock)
      const sent = sentAttendance(createMock)
      expect(sent.c2.status).toBe('late')
      expect(sent.c1.status).toBe('present')
    })

    test('scope change drops marks of catechists who left and keeps the others', async () => {
      data[EXPECTED] = (a: any) => (a.branchId === 'br-1' ? [c2, c3] : [c1, c2])
      data[SAVED] = {
        roster: [
          { catechistId: 'c1', status: 'late' },
          { catechistId: 'c2', status: 'excused_absence' },
        ],
        substitutes: [],
      }
      renderForm({ meeting: existing })
      await pick(screen.getAllByRole('combobox')[1], 'Ấu Nhi')
      await waitFor(() => expect(screen.getByText('Cuong')).toBeInTheDocument())
      expect(screen.queryByText('An')).not.toBeInTheDocument()
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const sent = Object.fromEntries(
        (updateMock.mock.calls[0][0].attendance as Array<any>).map((a) => [
          a.catechistId,
          a,
        ]),
      )
      expect(Object.keys(sent).sort()).toEqual(['c2', 'c3'])
      expect(sent.c2.status).toBe('excused_absence')
      expect(sent.c3.status).toBe('present')
    })

    test('edit: loads saved marks and notes', async () => {
      data[SAVED] = {
        roster: [
          { catechistId: 'c1', status: 'late', notes: 'traffic' },
          { catechistId: 'c2', status: null },
        ],
        substitutes: [],
      }
      renderForm({ meeting: existing })
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const sent = sentAttendance(updateMock)
      expect(sent.c1).toEqual({
        catechistId: 'c1',
        status: 'late',
        notes: 'traffic',
      })
      expect(sent.c2.status).toBe('present')
    })

    test('edit: a saved attendee outside the roster becomes an extra keeping its status', async () => {
      data[SAVED] = {
        roster: [],
        substitutes: [
          {
            catechistId: 'c4',
            status: 'excused_absence',
            fullName: 'Dung',
            saintName: null,
          },
        ],
      }
      const { container } = renderForm({ meeting: existing })
      expect(container.querySelectorAll('[id^="catechist-"]')).toHaveLength(2)
      expect(screen.getByText('Dung')).toBeInTheDocument()
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      expect(sentAttendance(updateMock).c4.status).toBe('excused_absence')
    })

    test('extra falls back to the saved name when not in the active list', () => {
      data[ALL] = []
      data[SAVED] = {
        roster: [],
        substitutes: [
          {
            catechistId: 'c9',
            status: 'present',
            fullName: 'Hien',
            saintName: 'Maria',
          },
        ],
      }
      renderForm({ meeting: existing })
      expect(screen.getByText('Maria Hien')).toBeInTheDocument()
    })

    test('adding an extra sends it as present attendee and removing it drops it', async () => {
      renderForm()
      type(/meetings\.fields\.title/, 'Họp')
      await addExtra(/Dung/)
      expect(
        await screen.findByLabelText('meetings.attendance.extraRemove'),
      ).toBeInTheDocument()
      await save(createMock)
      expect(sentAttendance(createMock).c4).toEqual({
        catechistId: 'c4',
        status: 'present',
        notes: undefined,
      })
    })

    test('removed extra is not sent', async () => {
      renderForm()
      type(/meetings\.fields\.title/, 'Họp')
      await addExtra(/Dung/)
      fireEvent.click(
        await screen.findByLabelText('meetings.attendance.extraRemove'),
      )
      expect(
        screen.queryByLabelText('meetings.attendance.extraRemove'),
      ).not.toBeInTheDocument()
      await save(createMock)
      expect(sentAttendance(createMock).c4).toBeUndefined()
    })

    test('roster members are not offered as extras', async () => {
      renderForm()
      fireEvent.mouseDown(extrasInput())
      await screen.findByText(/Cuong/)
      expect(screen.queryByRole('option', { name: /Binh/ })).toBeNull()
    })

    test('search filters roster tiles only, not extras', async () => {
      const { container } = renderForm()
      await addExtra(/Dung/)
      fireEvent.change(
        screen.getByPlaceholderText('meetings.attendance.searchPlaceholder'),
        { target: { value: 'binh' } },
      )
      expect(container.querySelectorAll('[id^="catechist-"]')).toHaveLength(1)
      expect(screen.getByText('Binh')).toBeInTheDocument()
      expect(
        screen.getByLabelText('meetings.attendance.extraRemove'),
      ).toBeInTheDocument()
      fireEvent.change(
        screen.getByPlaceholderText('meetings.attendance.searchPlaceholder'),
        { target: { value: 'glv1' } },
      )
      expect(screen.getByText('Anna')).toBeInTheDocument()
      fireEvent.change(
        screen.getByPlaceholderText('meetings.attendance.searchPlaceholder'),
        { target: { value: 'zzz' } },
      )
      expect(screen.getByText('common.noResultsFound')).toBeInTheDocument()
    })

    test('changing a tile status makes cancel ask for confirmation', async () => {
      const { container } = renderForm()
      setStatus(tile(c1, container), 'unexcused_absence')
      fireEvent.click(screen.getByText('common.cancel'))
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(onCancel).not.toHaveBeenCalled()
    })

    test('adding an extra makes cancel ask for confirmation', async () => {
      renderForm()
      await addExtra(/Dung/)
      fireEvent.click(screen.getByText('common.cancel'))
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    })

    test('removing an extra makes cancel ask for confirmation', async () => {
      data[SAVED] = {
        roster: [],
        substitutes: [
          {
            catechistId: 'c4',
            status: 'present',
            fullName: 'Dung',
            saintName: null,
          },
        ],
      }
      renderForm({ meeting: existing })
      fireEvent.click(screen.getByLabelText('meetings.attendance.extraRemove'))
      fireEvent.click(screen.getByText('common.cancel'))
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    })

    test('extra who joins the roster after a scope change stops being an extra', async () => {
      data[EXPECTED] = (a: any) =>
        a.branchId === 'br-1' ? [c1, c2, c4] : [c1, c2]
      data[SAVED] = {
        roster: [],
        substitutes: [
          {
            catechistId: 'c4',
            status: 'late',
            fullName: 'Dung',
            saintName: null,
          },
        ],
      }
      renderForm({ meeting: existing })
      expect(
        screen.getByLabelText('meetings.attendance.extraRemove'),
      ).toBeInTheDocument()
      await pick(screen.getAllByRole('combobox')[1], 'Ấu Nhi')
      await waitFor(() =>
        expect(
          screen.queryByLabelText('meetings.attendance.extraRemove'),
        ).not.toBeInTheDocument(),
      )
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const list = updateMock.mock.calls[0][0].attendance as Array<any>
      expect(list.filter((a) => a.catechistId === 'c4')).toHaveLength(1)
    })

    test('edit: a cancelled meeting stays editable and sends no attendance', async () => {
      data[SAVED] = {
        roster: [{ catechistId: 'c1', status: 'late' }],
        substitutes: [],
      }
      renderForm({ meeting: { ...existing, isCancelled: true } })
      type(/meetings\.fields\.notes/, 'New notes')
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const arg = updateMock.mock.calls[0][0]
      expect(arg.notes).toBe('New notes')
      expect(arg.attendance).toBeUndefined()
    })

    test('edit: a non-cancelled meeting still sends the attendance array', async () => {
      data[SAVED] = {
        roster: [{ catechistId: 'c1', status: 'late' }],
        substitutes: [],
      }
      renderForm({ meeting: { ...existing, isCancelled: false } })
      type(/meetings\.fields\.notes/, 'New notes')
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
      const arg = updateMock.mock.calls[0][0]
      expect(arg.notes).toBe('New notes')
      expect(arg.attendance).toHaveLength(2)
    })

    test('shows the error toast when saving attendance fails', async () => {
      createMock.mockRejectedValue(
        new Error('CATECHIST_ATTENDANCE_MEETING_CANCELLED'),
      )
      renderForm()
      type(/meetings\.fields\.title/, 'Họp')
      fireEvent.click(screen.getByText('common.save'))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(onSuccess).not.toHaveBeenCalled()
    })

    describe('scan dialog', () => {
      test('opening sets unset roster entries to unexcused absence', async () => {
        renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        openScan()
        expect(await screen.findByTestId('qr-scanner')).toBeInTheDocument()
        scan('GLV1')
        await closeScan()
        await save(createMock)
        const sent = sentAttendance(createMock)
        expect(sent.c1.status).toBe('present')
        expect(sent.c2.status).toBe('unexcused_absence')
      })

      test('opening keeps existing marks', async () => {
        const { container } = renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        setStatus(tile(c2, container), 'late')
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV1')
        await closeScan()
        await save(createMock)
        expect(sentAttendance(createMock).c2.status).toBe('late')
      })

      test('closing with nothing scanned restores the previous marks', async () => {
        renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        openScan()
        await screen.findByTestId('qr-scanner')
        await closeScan()
        await save(createMock)
        const sent = sentAttendance(createMock)
        expect(sent.c1.status).toBe('present')
        expect(sent.c2.status).toBe('present')
      })

      test('a scan session without scans restores defaults even after a productive earlier session', async () => {
        data[EXPECTED] = (a: any) =>
          a.branchId === 'br-1' ? [c1, c3] : [c1, c2]
        renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV1')
        await closeScan()
        // roster grows: c3 is unset when the second session opens
        await pick(screen.getAllByRole('combobox')[0], 'meetings.scope.branch')
        await pick(screen.getAllByRole('combobox')[1], 'Ấu Nhi')
        await screen.findByText('Cuong')
        openScan()
        await screen.findByTestId('qr-scanner')
        await closeScan()
        await save(createMock)
        const sent = sentAttendance(createMock)
        expect(sent.c1.status).toBe('present')
        expect(sent.c3.status).toBe('present')
      })

      test('an unproductive reopen keeps the earlier session scan', async () => {
        renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV1')
        await closeScan()
        openScan()
        await screen.findByTestId('qr-scanner')
        await closeScan()
        await save(createMock)
        const sent = sentAttendance(createMock)
        expect(sent.c1.status).toBe('present')
        expect(sent.c2.status).toBe('unexcused_absence')
      })

      test('scanning a roster member marks present and shows success feedback', async () => {
        renderForm()
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('glv2')
        const status = await screen.findByRole('status')
        expect(status).toHaveTextContent('Binh')
        expect(status).toHaveTextContent('attendance.scanning.overlay.success')
      })

      test('scanning the same member again shows duplicate feedback after the debounce', async () => {
        renderForm()
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV2')
        act(() => vi.setSystemTime(new Date('2024-10-05T08:00:02')))
        scan('GLV2')
        expect(screen.getByRole('status')).toHaveTextContent(
          'attendance.scanning.overlay.duplicate',
        )
      })

      test('a repeated scan inside the debounce window is ignored', async () => {
        renderForm()
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV2')
        act(() => vi.setSystemTime(new Date('2024-10-05T08:00:00.100')))
        scan('GLV2')
        expect(screen.getByRole('status')).toHaveTextContent(
          'attendance.scanning.overlay.success',
        )
      })

      test('a late member counts as duplicate', async () => {
        const { container } = renderForm()
        setStatus(tile(c1, container), 'late')
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV1')
        expect(screen.getByRole('status')).toHaveTextContent(
          'attendance.scanning.overlay.duplicate',
        )
      })

      test('scanning an off-roster active catechist adds them as a present extra', async () => {
        renderForm()
        type(/meetings\.fields\.title/, 'Họp')
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV4')
        expect(screen.getByRole('status')).toHaveTextContent('Dung')
        await closeScan()
        await save(createMock)
        expect(sentAttendance(createMock).c4.status).toBe('present')
        expect(
          screen.getByLabelText('meetings.attendance.extraRemove'),
        ).toBeInTheDocument()
      })

      test('an extra already added but absent is marked present by scan', async () => {
        data[SAVED] = {
          roster: [],
          substitutes: [
            {
              catechistId: 'c4',
              status: 'excused_absence',
              fullName: 'Dung',
              saintName: null,
            },
          ],
        }
        renderForm({ meeting: existing })
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV4')
        expect(screen.getByRole('status')).toHaveTextContent(
          'attendance.scanning.overlay.success',
        )
        await closeScan()
        fireEvent.click(screen.getByText('common.save'))
        await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
        expect(sentAttendance(updateMock).c4.status).toBe('present')
      })

      test.each([
        ['unknown member', 'GLV99', 'catechist'],
        ['student QR', 'ST1', 'student'],
      ])(
        '%s shows unknown feedback and changes nothing',
        async (_n, id, ty) => {
          renderForm()
          type(/meetings\.fields\.title/, 'Họp')
          openScan()
          await screen.findByTestId('qr-scanner')
          scan(id, ty)
          expect(screen.getByRole('status')).toHaveTextContent(
            'meetings.attendance.scanUnknown',
          )
          await closeScan()
          await save(createMock)
          expect(sentAttendance(createMock).c1.status).toBe('present')
          expect(sentAttendance(createMock).c4).toBeUndefined()
        },
      )

      test('plain text and invalid JSON codes are unknown', async () => {
        renderForm()
        openScan()
        await screen.findByTestId('qr-scanner')
        act(() => scanHandler!('{not json'))
        expect(screen.getByRole('status')).toHaveTextContent(
          'meetings.attendance.scanUnknown',
        )
      })

      test('feedback disappears after two seconds', () => {
        vi.useRealTimers()
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
        renderForm()
        openScan()
        expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
        scan('GLV2')
        expect(screen.getByRole('status')).toBeInTheDocument()
        act(() => {
          vi.advanceTimersByTime(2100)
        })
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      test('scan marks the form dirty', async () => {
        renderForm()
        openScan()
        await screen.findByTestId('qr-scanner')
        scan('GLV2')
        await closeScan()
        fireEvent.click(screen.getByText('common.cancel'))
        expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      })
    })
  })
})
