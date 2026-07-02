import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CatechistContactDialogForm } from './catechist-contact-dialog-form'

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

vi.mock('~/components/custom/inputs/phone-input', () => ({
  PhoneInput: ({ value, onChange, onBlur, placeholder, inputProps }: any) => (
    <input
      data-testid="phone-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      {...inputProps}
    />
  ),
}))

describe('CatechistContactDialogForm', () => {
  let mockOnSubmit: any

  beforeEach(() => {
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
  })

  test('renders form fields with default values', () => {
    render(<CatechistContactDialogForm onSubmit={mockOnSubmit} />)

    expect(
      screen.getByLabelText(/profile\.contacts\.col\.label/),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('profile.contacts.value.placeholder'),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  test('renders with initial values', () => {
    render(
      <CatechistContactDialogForm
        initialValues={{
          label: 'Work Phone',
          contactType: 'email',
          value: 'test@example.com',
          isPrimary: true,
          notes: 'Office email',
        }}
        onSubmit={mockOnSubmit}
      />,
    )

    expect(screen.getByLabelText(/profile\.contacts\.col\.label/)).toHaveValue(
      'Work Phone',
    )
    expect(screen.getByLabelText(/profile\.contacts\.col\.notes/)).toHaveValue(
      'Office email',
    )
  })

  test('calls onSubmit with correct values', async () => {
    render(<CatechistContactDialogForm onSubmit={mockOnSubmit} />)

    fireEvent.change(
      screen.getByLabelText(/profile\.contacts\.col\.label/),
      { target: { value: 'Mobile' } },
    )
    const valueInput = screen.getAllByPlaceholderText('profile.contacts.value.placeholder')[0]
    fireEvent.change(valueInput, { target: { value: '+84901234567' } })
    fireEvent.blur(valueInput)

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Mobile',
          contactType: 'phone',
          value: '+84901234567',
          isPrimary: false,
        }),
      )
    })
  })

  test('requires label field', async () => {
    render(<CatechistContactDialogForm onSubmit={mockOnSubmit} />)

    const labelInput = screen.getByLabelText(/profile\.contacts\.col\.label/)
    fireEvent.blur(labelInput)

    await waitFor(() => {
      expect(screen.getByText('common.required')).toBeInTheDocument()
    })
  })

  test('shows phone input when contact type is phone', () => {
    render(<CatechistContactDialogForm onSubmit={mockOnSubmit} />)

    const typeSelect = screen.getByTestId('mock-select')
    expect(typeSelect).toHaveValue('phone')
    expect(screen.getByTestId('phone-input')).toBeInTheDocument()
  })

  test('switches to regular input when contact type changes', () => {
    render(<CatechistContactDialogForm onSubmit={mockOnSubmit} />)

    const typeSelect = screen.getByTestId('mock-select')
    fireEvent.change(typeSelect, { target: { value: 'email' } })

    expect(screen.queryByTestId('phone-input')).not.toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('profile.contacts.value.placeholder'),
    ).toBeInTheDocument()
  })

  test('shows error toast when onSubmit rejects', async () => {
    const rejectingSubmit = vi.fn().mockRejectedValue(new Error('fail'))

    const { toast } = await import('sonner')

    render(<CatechistContactDialogForm onSubmit={rejectingSubmit} />)

    fireEvent.change(
      screen.getByLabelText(/profile\.contacts\.col\.label/),
      { target: { value: 'Mobile' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('profile.contacts.value.placeholder'),
      { target: { value: '84901234567' } },
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('profile.contacts.saveError')
    })
  })

  test('shows isPrimary checkbox checked when initial value is true', () => {
    render(
      <CatechistContactDialogForm
        initialValues={{
          label: 'Primary',
          contactType: 'phone',
          value: '+84901234567',
          isPrimary: true,
          notes: '',
        }}
        onSubmit={mockOnSubmit}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })
})