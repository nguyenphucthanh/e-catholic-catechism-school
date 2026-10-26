import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAction } from 'convex/react'
import { Route } from './students_.create'
import type * as StudentFormModule from '~/components/forms/student-form'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  createFileRoute: vi.fn(() => (options: any) => ({
    options,
    useSearch: () => ({}),
  })),
}))

vi.mock(
  '~/components/forms/student-form',
  async (importOriginal: () => Promise<typeof StudentFormModule>) => {
    const actual = await importOriginal()
    const patch = (values: any, extra: object) => ({ ...values, ...extra })
    return {
      ...actual,
      // Lets tests drive onChange like the real form
      StudentForm: ({ values, onChange }: any) => {
        const actions: Record<string, object> = {
          'set-name': { fullName: ' Nguyen Van A ' },
          'set-contact': { phone: '+84912345678', email: ' a@b.com ' },
          'set-bad-email': { email: 'not-an-email' },
          'set-bad-phone': { phone: '+84123' },
        }
        return (
          <div data-testid="student-form">
            {Object.entries(actions).map(([label, extra]) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(patch(values, extra))}
              >
                {label}
              </button>
            ))}
          </div>
        )
      },
    }
  },
)

vi.mock('~/components/custom/student-photo-upload', () => ({
  StudentPhotoUpload: () => <div data-testid="student-photo-upload" />,
}))

describe('CreateStudentPage phone/email', () => {
  const create = vi.fn()

  const setup = () => {
    const Component = (Route as any).options.component
    render(<Component />)
  }
  const submit = () =>
    fireEvent.click(screen.getAllByText('students.create.title').at(-1)!)

  beforeEach(() => {
    create.mockReset().mockResolvedValue({
      studentId: 'student-1',
      credential: { loginId: '1', password: 'pw' },
    })
    vi.mocked(useAction).mockImplementation(((ref: any) =>
      ref?.[Symbol.for('functionName')] === 'students:createStudentWithProfile'
        ? create
        : vi.fn()) as any)
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'user-1', userDocId: 'catechist-1', role: 'user' } as any,
    })
  })

  test('sends trimmed phone and email inside student', async () => {
    setup()
    fireEvent.click(screen.getByText('set-name'))
    fireEvent.click(screen.getByText('set-contact'))
    submit()
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].student).toMatchObject({
      fullName: 'Nguyen Van A',
      phone: '+84912345678',
      email: 'a@b.com',
    })
  })

  test('sends undefined when phone and email are empty', async () => {
    setup()
    fireEvent.click(screen.getByText('set-name'))
    submit()
    await waitFor(() => expect(create).toHaveBeenCalled())
    const { student } = create.mock.calls[0][0]
    expect(student.phone).toBeUndefined()
    expect(student.email).toBeUndefined()
  })

  test.each(['set-bad-email', 'set-bad-phone'])(
    'blocks submit on %s',
    async (btn) => {
      setup()
      fireEvent.click(screen.getByText('set-name'))
      fireEvent.click(screen.getByText(btn))
      submit()
      await new Promise((r) => setTimeout(r, 50))
      expect(create).not.toHaveBeenCalled()
    },
  )
})
