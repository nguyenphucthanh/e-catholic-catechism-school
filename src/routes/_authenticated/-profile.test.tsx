import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Route } from './profile'
import { useAuth } from '~/lib/auth'

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

const mockCatechistUser = {
  _id: 'user123',
  userDocId: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  role: 'user',
} as any

function setupProfileQuery() {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'catechists:getMyProfile') {
      return {
        _id: 'catechist123',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        saintName: 'Giuse',
        role: 'user',
        isActive: true,
        isDeleted: false,
      }
    }
    if (path === 'catechists:getMyAddress') {
      return {
        _id: 'address123',
        catechistId: 'catechist123',
        country: 'VN',
        city: 'Hồ Chí Minh',
        isDeleted: false,
      }
    }
    if (path === 'catechists:getMyContacts') {
      return [
        {
          _id: 'contact123',
          catechistId: 'catechist123',
          label: 'Personal Phone',
          contactType: 'phone',
          value: '+84912345678',
          isPrimary: true,
          isDeleted: false,
        },
      ]
    }
    return undefined
  })
}

describe('ProfilePage component', () => {
  test('renders personal info, address, and contacts successfully when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByLabelText(/profile\.personal\.fullName/)).toHaveValue(
      'Nguyễn Văn A',
    )
    expect(screen.getByLabelText(/profile\.personal\.saintName/)).toHaveValue(
      'Giuse',
    )
    expect(screen.getByLabelText(/profile\.address\.city/)).toHaveValue(
      'Hồ Chí Minh',
    )
    expect(screen.getByText('+84912345678')).toBeInTheDocument()
  })

  test('renders stale session message when userDocId is missing', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: {
        _id: 'user123',
        memberId: 'GLV0001',
        fullName: 'Nguyễn Văn A',
        role: 'user',
      } as any,
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(
      screen.getByRole('button', { name: 'auth.stale_session_action' }),
    ).toBeInTheDocument()
  })

  test('shows page header when profile loads', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('profile.title')).toBeInTheDocument()
  })

  test('renders Add Contact button when data is loaded', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addButtons = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })
    expect(addButtons.length).toBeGreaterThanOrEqual(1)
  })

  test('renders save buttons in personal info and address sections', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    // Personal info save button uses profile.personal.save key
    const saveButtons = screen.getAllByRole('button', {
      name: /profile\.personal\.save|profile\.address\.save/i,
    })
    expect(saveButtons.length).toBeGreaterThanOrEqual(1)
  })

  test('renders skeleton when queries are loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockReturnValue(undefined)

    const ProfilePageComponent = (Route as any).options.component
    const { container } = render(<ProfilePageComponent />)

    expect(
      container.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument()
  })

  test('calls updateProfile mutation when personal info form is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockUpdateProfile = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdateProfile as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const fullNameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(fullNameInput, { target: { value: 'New Name' } })

    // Personal info save button uses profile.personal.save key
    const saveButton = screen.getByRole('button', {
      name: 'profile.personal.save',
    })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
    })
  })

  test('renders contact badge for primary contacts', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    // Primary badge should be visible for the primary contact
    expect(screen.getByText('profile.contacts.primary')).toBeInTheDocument()
  })

  test('renders empty contacts section with no contact items when contacts list is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') {
        return {
          _id: 'catechist123',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyAddress') return null
      if (path === 'catechists:getMyContacts') return []
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    // Phone number should not be visible
    expect(screen.queryByText('+84912345678')).not.toBeInTheDocument()
  })

  test('renders empty contacts message when contacts list is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') {
        return {
          _id: 'catechist123',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyAddress') return null
      if (path === 'catechists:getMyContacts') return []
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('profile.contacts.empty')).toBeInTheDocument()
  })

  test('renders address form fields when address data is provided', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    // Address line 1 label should be rendered
    expect(screen.getByLabelText('profile.address.line1')).toBeInTheDocument()
    // City input should have the mocked value
    expect(screen.getByLabelText('profile.address.city')).toHaveValue(
      'Hồ Chí Minh',
    )
  })

  test('renders address save button when address section loads', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(
      screen.getByRole('button', { name: 'profile.address.save' }),
    ).toBeInTheDocument()
  })

  test('add contact dialog opens when add contact button is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addBtn = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })[0]
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })
  })

  test('renders address form with empty fields when no prior address exists', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') {
        return {
          _id: 'catechist123',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyAddress') return null // no prior address
      if (path === 'catechists:getMyContacts') return []
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    // City field should be empty when no address
    expect(screen.getByLabelText('profile.address.city')).toHaveValue('')
  })

  test('renders contacts section title', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('profile.contacts.title')).toBeInTheDocument()
  })

  test('renders personal info section title', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('profile.personal.title')).toBeInTheDocument()
  })

  test('renders not_found message when profile query resolves to null', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') return null
      if (path === 'catechists:getMyAddress') return null
      if (path === 'catechists:getMyContacts') return []
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('profile.personal.not_found')).toBeInTheDocument()
  })

  test('opens edit contact dialog prefilled with existing contact values', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const editItem = await screen.findByText('common.edit')
    fireEvent.click(editItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.edit'),
      ).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/profile\.contacts\.col\.label/)).toHaveValue(
      'Personal Phone',
    )
  })

  test('calls updateContact mutation when editing an existing contact is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockUpdateContact = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpdateContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const editItem = await screen.findByText('common.edit')
    fireEvent.click(editItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.edit'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockUpdateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'contact123',
          label: 'Personal Phone',
          contactType: 'phone',
          isPrimary: true,
        }),
      )
    })
  })

  test('calls addContact mutation with E.164-formatted value when a new phone contact is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockAddContact = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockAddContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addBtn = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })[0]
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/profile\.contacts\.col\.label/), {
      target: { value: 'Work Phone' },
    })
    fireEvent.change(screen.getByLabelText(/profile\.contacts\.col\.value/), {
      target: { value: '84912345678' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(mockAddContact).toHaveBeenCalledWith(
        expect.objectContaining({
          catechistId: 'catechist123',
          label: 'Work Phone',
          contactType: 'phone',
          value: '+84912345678',
        }),
      )
    })
  })

  test('shows saveError toast when contact mutation rejects', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockUpdateContact = vi.fn().mockRejectedValue(new Error('fail'))
    vi.mocked(useMutation).mockReturnValue(mockUpdateContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const editItem = await screen.findByText('common.edit')
    fireEvent.click(editItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.edit'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('profile.contacts.saveError')
    })
  })

  test('opens delete confirmation dialog for a contact', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })
  })

  test('calls deleteContact mutation and shows success toast when delete is confirmed', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockDeleteContact = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockDeleteContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'profile.contacts.delete.confirm',
      }),
    )

    await waitFor(() => {
      expect(mockDeleteContact).toHaveBeenCalledWith({
        contactId: 'contact123',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('profile.contacts.deleted')
  })

  test('shows deleteError toast when deleteContact mutation rejects', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockDeleteContact = vi.fn().mockRejectedValue(new Error('fail'))
    vi.mocked(useMutation).mockReturnValue(mockDeleteContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'profile.contacts.delete.confirm',
      }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('profile.contacts.deleteError')
    })
  })

  test('cancel button in contact delete dialog closes it without calling deleteContact', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockDeleteContact = vi.fn()
    vi.mocked(useMutation).mockReturnValue(mockDeleteContact as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.click(screen.getByRole('button', { name: 'common.moreActions' }))
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByText('profile.contacts.delete.title'),
      ).not.toBeInTheDocument()
    })
    expect(mockDeleteContact).not.toHaveBeenCalled()
  })

  test('calls upsertMyAddress mutation when address form is submitted', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const mockUpsertAddress = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockReturnValue(mockUpsertAddress as any)

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    fireEvent.change(screen.getByLabelText('profile.address.city'), {
      target: { value: 'Hà Nội' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'profile.address.save' }),
    )

    await waitFor(() => {
      expect(mockUpsertAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          catechistId: 'catechist123',
          city: 'Hà Nội',
        }),
      )
    })
  })

  test('shows fullName required validation error when full name is cleared and blurred', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const fullNameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(fullNameInput, { target: { value: '' } })
    fireEvent.blur(fullNameInput)

    await waitFor(() => {
      expect(
        screen.getByText('profile.personal.fullName.required'),
      ).toBeInTheDocument()
    })
  })

  test('shows required error for contact label when blurred empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addBtn = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })[0]
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })

    const labelInput = screen.getByLabelText(/profile\.contacts\.col\.label/)
    fireEvent.blur(labelInput)

    await waitFor(() => {
      expect(screen.getByText('common.required')).toBeInTheDocument()
    })
  })

  test('shows invalid phone error when an invalid phone number is entered for a phone contact', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addBtn = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })[0]
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })

    const valueInput = screen.getByLabelText(/profile\.contacts\.col\.value/)
    fireEvent.change(valueInput, { target: { value: '123' } })

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.phone.invalid'),
      ).toBeInTheDocument()
    })
  })

  test('toggles isPrimary checkbox in contact dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    setupProfileQuery()

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    const addBtn = screen.getAllByRole('button', {
      name: /profile\.contacts\.add/i,
    })[0]
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  test('renders contact label and notes joined with separator', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: mockCatechistUser,
    })
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef[Symbol.for('functionName')]
      if (path === 'catechists:getMyProfile') {
        return {
          _id: 'catechist123',
          memberId: 'GLV0001',
          fullName: 'Nguyễn Văn A',
          role: 'user',
          isActive: true,
          isDeleted: false,
        }
      }
      if (path === 'catechists:getMyAddress') return null
      if (path === 'catechists:getMyContacts') {
        return [
          {
            _id: 'contact999',
            catechistId: 'catechist123',
            label: 'Home',
            notes: 'Call after 6pm',
            contactType: 'other',
            value: 'some-value',
            isPrimary: false,
            isDeleted: false,
          },
        ]
      }
      return undefined
    })

    const ProfilePageComponent = (Route as any).options.component
    render(<ProfilePageComponent />)

    expect(screen.getByText('Home · Call after 6pm')).toBeInTheDocument()
  })
})
