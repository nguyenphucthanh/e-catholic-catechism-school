import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CatechistPersonalInfoFields,
  CatechistPersonalInfoForm,
} from './catechist-personal-info-form'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

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

describe('CatechistPersonalInfoForm', () => {
  const defaultValues = {
    fullName: 'Nguyễn Văn A',
    saintName: 'Giuse',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    joinedDate: '2023-09-01',
    notes: 'Some notes',
    title: 'Cha',
    community: 'Dòng Chúa Cứu Thế',
    level: '1',
  }

  let mockOnSubmit: any

  beforeEach(() => {
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
  })

  test('renders all form fields', () => {
    render(
      <CatechistPersonalInfoForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
      />,
    )

    expect(screen.getByLabelText(/profile\.personal\.saintName/)).toHaveValue(
      'Giuse',
    )
    expect(screen.getByLabelText(/profile\.personal\.fullName/)).toHaveValue(
      'Nguyễn Văn A',
    )
    expect(screen.getByLabelText(/profile\.personal\.dob/)).toHaveValue(
      '1990-01-01',
    )
    expect(screen.getByLabelText(/profile\.personal\.notes/)).toHaveValue(
      'Some notes',
    )
    expect(screen.getByLabelText(/profile\.personal\.joinedDate/)).toHaveValue(
      '2023-09-01',
    )
    expect(screen.getByLabelText(/profile\.personal\.community/)).toHaveValue(
      'Dòng Chúa Cứu Thế',
    )
    expect(screen.getByLabelText(/profile\.personal\.level/)).toHaveValue('1')
  })

  test('calls onSubmit with correct values', async () => {
    render(
      <CatechistPersonalInfoForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Nguyễn Văn A',
          saintName: 'Giuse',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          joinedDate: '2023-09-01',
          notes: 'Some notes',
          title: 'Cha',
          community: 'Dòng Chúa Cứu Thế',
          level: '1',
        }),
      )
    })
  })

  test('shows required validation when fullName is cleared', async () => {
    render(
      <CatechistPersonalInfoForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
      />,
    )

    const nameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.blur(nameInput)

    await waitFor(() => {
      expect(
        screen.getByText('profile.personal.fullName.required'),
      ).toBeInTheDocument()
    })
  })

  test('converts empty values to undefined on submit', async () => {
    render(
      <CatechistPersonalInfoForm
        initialValues={{
          fullName: 'Test',
          saintName: '',
          dateOfBirth: '',
          gender: '',
          joinedDate: '',
          notes: '',
          title: '',
          community: '',
          level: '',
        }}
        onSubmit={mockOnSubmit}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Test',
          saintName: undefined,
          dateOfBirth: undefined,
          gender: undefined,
          joinedDate: undefined,
          notes: undefined,
          title: undefined,
          community: undefined,
          level: undefined,
        }),
      )
    })
  })

  test('calls onDirtyChange when fields change', () => {
    const onDirtyChange = vi.fn()

    render(
      <CatechistPersonalInfoForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
        onDirtyChange={onDirtyChange}
      />,
    )

    const saintInput = screen.getByLabelText(/profile\.personal\.saintName/)
    fireEvent.change(saintInput, { target: { value: 'Phêrô' } })

    const nameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    const dobInput = screen.getByLabelText(/profile\.personal\.dob/)
    fireEvent.change(dobInput, { target: { value: '1995-05-05' } })

    const joinedInput = screen.getByLabelText(/profile\.personal\.joinedDate/)
    fireEvent.change(joinedInput, { target: { value: '2024-01-01' } })

    const notesInput = screen.getByLabelText(/profile\.personal\.notes/)
    fireEvent.change(notesInput, { target: { value: 'Updated notes' } })

    const communityInput = screen.getByLabelText(/profile\.personal\.community/)
    fireEvent.change(communityInput, { target: { value: 'New Community' } })

    const levelInput = screen.getByLabelText(/profile\.personal\.level/)
    fireEvent.change(levelInput, { target: { value: '2' } })

    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  test('submits using custom submit label', () => {
    render(
      <CatechistPersonalInfoForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
        submitLabel="profile.personal.save"
        fullWidthSubmit={true}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'profile.personal.save' }),
    ).toBeInTheDocument()
  })

  test('renders CatechistPersonalInfoFields with roleField and select options', () => {
    const roleFieldMock = <div data-testid="role-field">Role Field</div>
    const mockForm = {
      Field: ({ children }: any) =>
        children({
          state: { value: '', meta: { errors: [] } },
          handleChange: vi.fn(),
          handleBlur: vi.fn(),
        }),
    }

    render(
      <CatechistPersonalInfoFields
        form={mockForm as any}
        roleField={roleFieldMock}
      />,
    )

    expect(screen.getByTestId('role-field')).toBeInTheDocument()

    const selectElements = screen.getAllByTestId('mock-select')
    fireEvent.change(selectElements[0], { target: { value: 'female' } })
    fireEvent.change(selectElements[1], { target: { value: 'Thầy' } })
  })

  test('converts empty string values to undefined on submit', async () => {
    const emptyValues = {
      fullName: 'Trần Văn B',
      saintName: '',
      dateOfBirth: '',
      gender: '',
      joinedDate: '',
      notes: '',
      title: '',
      community: '',
      level: '',
    }

    render(
      <CatechistPersonalInfoForm
        initialValues={emptyValues}
        onSubmit={mockOnSubmit}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        fullName: 'Trần Văn B',
        saintName: undefined,
        dateOfBirth: undefined,
        gender: undefined,
        joinedDate: undefined,
        notes: undefined,
        title: undefined,
        community: undefined,
        level: undefined,
      })
    })
  })
})
