import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CatechistAddressForm } from './catechist-address-form'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('CatechistAddressForm', () => {
  const defaultValues = {
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'Hồ Chí Minh',
    stateProvince: '',
    postalCode: '70000',
    hamlet: 'Giao Ho 1',
    subHamlet: 'Giao Xom 2',
  }

  let mockOnSubmit: any

  beforeEach(() => {
    mockOnSubmit = vi.fn().mockResolvedValue(undefined)
  })

  test('renders all form fields', () => {
    render(
      <CatechistAddressForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
      />,
    )

    expect(screen.getByLabelText('profile.address.line1')).toHaveValue(
      '123 Main St',
    )
    expect(screen.getByLabelText('profile.address.line2')).toHaveValue('Apt 4B')
    expect(screen.getByLabelText('profile.address.city')).toHaveValue(
      'Hồ Chí Minh',
    )
    expect(screen.getByLabelText('profile.address.postal')).toHaveValue('70000')
    expect(screen.getByLabelText('profile.address.hamlet')).toHaveValue(
      'Giao Ho 1',
    )
    expect(screen.getByLabelText('profile.address.subHamlet')).toHaveValue(
      'Giao Xom 2',
    )
  })

  test('calls onSubmit with correct values', async () => {
    render(
      <CatechistAddressForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'VN',
          addressLine1: '123 Main St',
          addressLine2: 'Apt 4B',
          city: 'Hồ Chí Minh',
          postalCode: '70000',
          hamlet: 'Giao Ho 1',
          subHamlet: 'Giao Xom 2',
        }),
      )
    })
  })

  test('converts empty values to undefined on submit', async () => {
    render(
      <CatechistAddressForm
        initialValues={{
          addressLine1: '',
          addressLine2: '',
          city: '',
          stateProvince: '',
          postalCode: '',
          hamlet: '',
          subHamlet: '',
        }}
        onSubmit={mockOnSubmit}
      />,
    )

    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'VN',
          addressLine1: undefined,
          addressLine2: undefined,
          city: undefined,
          stateProvince: undefined,
          postalCode: undefined,
          hamlet: undefined,
          subHamlet: undefined,
        }),
      )
    })
  })

  test('triggers onDirtyChange when input fields change', () => {
    const mockOnDirtyChange = vi.fn()
    render(
      <CatechistAddressForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
        onDirtyChange={mockOnDirtyChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('profile.address.line1'), {
      target: { value: 'New Street 1' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.line2'), {
      target: { value: 'Apt 5' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.city'), {
      target: { value: 'Hà Nội' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.state'), {
      target: { value: 'MN' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.hamlet'), {
      target: { value: 'Hamlet 2' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.subHamlet'), {
      target: { value: 'SubHamlet 3' },
    })
    fireEvent.change(screen.getByLabelText('profile.address.postal'), {
      target: { value: '10000' },
    })

    expect(mockOnDirtyChange).toHaveBeenCalled()
  })

  test('uses custom submit label', () => {
    render(
      <CatechistAddressForm
        initialValues={defaultValues}
        onSubmit={mockOnSubmit}
        submitLabel="profile.address.save"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'profile.address.save' }),
    ).toBeInTheDocument()
  })
})
