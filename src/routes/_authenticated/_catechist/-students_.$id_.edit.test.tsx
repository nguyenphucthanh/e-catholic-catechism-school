import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { Route } from './students_.$id_.edit'
import type * as StudentFormModule from '~/components/forms/student-form'
import { useAuth } from '~/lib/auth'

const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: 'student-1' })))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  createFileRoute: vi.fn(() => (options: any) => ({
    options,
    useParams: mockUseParams,
  })),
}))

vi.mock(
  '~/components/forms/student-form',
  async (importOriginal: () => Promise<typeof StudentFormModule>) => {
    const actual = await importOriginal()
    return {
      ...actual,
      // Exposes contact values and lets tests drive onChange like the real form
      StudentForm: ({ values, onChange }: any) => (
        <div data-testid="student-form">
          <span data-testid="phone-value">{values.phone}</span>
          <span data-testid="email-value">{values.email}</span>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...values,
                phone: '+84912345678',
                email: '  new@test.com ',
              })
            }
          >
            set-contact
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...values, phone: '', email: '' })}
          >
            clear-contact
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...values, email: 'not-an-email' })}
          >
            set-bad-email
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...values, phone: '+84123' })}
          >
            set-bad-phone
          </button>
        </div>
      ),
    }
  },
)

vi.mock('~/components/custom/student-photo-upload', () => ({
  StudentPhotoUpload: () => <div data-testid="student-photo-upload" />,
}))

const baseStudentDetail = {
  _id: 'student-1',
  studentCode: '1001',
  fullName: 'Nguyễn Thị A',
  saintName: 'Maria',
  dateOfBirth: '2015-05-01',
  gender: 'female',
  isActive: true,
  isDeleted: false,
  previousParish: '',
  previousDiocese: '',
  address: null,
  sacraments: [],
  guardians: [],
  siblings: [],
  enrollments: [],
}

const baseGuardianData = {
  guardians: [],
}

describe('EditStudentPage / EditStudentForm', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user-1',
        userDocId: 'catechist-1',
        role: 'user',
      } as any,
    })
  })

  test('renders contactAdmin message when student is not editable', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...baseStudentDetail, isEditable: false }
      }
      if (path === 'students:get') {
        return baseGuardianData
      }
      return undefined
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
    expect(screen.queryByTestId('student-form')).not.toBeInTheDocument()
  })

  test('renders edit form when student is editable', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'students:getStudentDetail') {
        return { ...baseStudentDetail, isEditable: true }
      }
      if (path === 'students:get') {
        return baseGuardianData
      }
      return undefined
    })

    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.queryByText('common.contactAdmin')).not.toBeInTheDocument()
    expect(screen.getByTestId('student-form')).toBeInTheDocument()
    expect(screen.getByTestId('student-photo-upload')).toBeInTheDocument()
  })

  describe('phone/email', () => {
    const updateStudent = vi.fn().mockResolvedValue(undefined)

    const setup = (detail: Record<string, unknown>) => {
      updateStudent.mockClear()
      vi.mocked(useMutation).mockImplementation(((ref: any) =>
        ref?.[Symbol.for('functionName')] === 'students:update'
          ? updateStudent
          : vi.fn().mockResolvedValue(undefined)) as any)
      vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
        const path = queryRef?.[Symbol.for('functionName')]
        if (path === 'students:getStudentDetail') {
          return { ...baseStudentDetail, isEditable: true, ...detail }
        }
        if (path === 'students:get') return baseGuardianData
        return undefined
      })
      const Component = (Route as any).options.component
      render(<Component />)
    }

    const save = () => fireEvent.click(screen.getByText('common.save'))

    test('pre-populates phone and email from studentData', () => {
      setup({
        canViewSensitive: true,
        phone: '+84912345678',
        email: 'a@b.com',
      })
      expect(screen.getByTestId('phone-value')).toHaveTextContent(
        '+84912345678',
      )
      expect(screen.getByTestId('email-value')).toHaveTextContent('a@b.com')
    })

    test('falls back to empty strings when contact is absent', () => {
      setup({ canViewSensitive: false })
      expect(screen.getByTestId('phone-value')).toBeEmptyDOMElement()
      expect(screen.getByTestId('email-value')).toBeEmptyDOMElement()
    })

    test('sends trimmed phone/email when canViewSensitive is true', async () => {
      setup({ canViewSensitive: true })
      fireEvent.click(screen.getByText('set-contact'))
      save()
      await waitFor(() => expect(updateStudent).toHaveBeenCalled())
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+84912345678',
          email: 'new@test.com',
        }),
      )
    })

    test('omits phone/email when canViewSensitive is false', async () => {
      setup({ canViewSensitive: false })
      fireEvent.click(screen.getByText('set-contact'))
      save()
      await waitFor(() => expect(updateStudent).toHaveBeenCalled())
      const args = updateStudent.mock.calls[0][0]
      expect(args).not.toHaveProperty('phone')
      expect(args).not.toHaveProperty('email')
    })

    test('sends empty strings to clear existing contact', async () => {
      setup({
        canViewSensitive: true,
        phone: '+84912345678',
        email: 'a@b.com',
      })
      fireEvent.click(screen.getByText('clear-contact'))
      save()
      await waitFor(() => expect(updateStudent).toHaveBeenCalled())
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '', email: '' }),
      )
    })

    test.each(['set-bad-email', 'set-bad-phone'])(
      'blocks submit on %s',
      async (btn) => {
        setup({ canViewSensitive: true })
        fireEvent.click(screen.getByText(btn))
        save()
        await new Promise((r) => setTimeout(r, 50))
        expect(updateStudent).not.toHaveBeenCalled()
      },
    )
  })
})
