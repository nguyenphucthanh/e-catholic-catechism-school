import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { Route } from './catechists_.create'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { DEFAULT_COUNTRY } from '~/lib/locale'

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

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useMutation).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

describe('CreateCatechistPage', () => {
  test('redirects non-admin (renders unauthorized)', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('form renders all personal info fields', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    expect(
      screen.getByLabelText(/profile\.personal\.fullName/),
    ).toBeInTheDocument()
    // Check role placeholder is visible (no value pre-selected)
    expect(screen.getByText('catechists.role.placeholder')).toBeInTheDocument()
  })

  test('clean form navigates directly on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/catechists' })
  })

  test('dirty form shows AlertDialog on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    const nameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(navigateMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('catechists.confirmLeave.title'),
    ).toBeInTheDocument()
  })

  test('staged contacts interactions (add, edit, delete, primary conflict)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    // Add first contact
    fireEvent.click(screen.getByText('catechists.create.contacts.add'))
    let valueInput = screen.getByLabelText(/profile\.contacts\.col\.value/)
    fireEvent.change(valueInput, { target: { value: '84901234567' } })
    const saveBtns = screen.getAllByText('common.save')
    fireEvent.click(saveBtns[0])

    await waitFor(() => {
      expect(screen.getByText('+84901234567')).toBeInTheDocument()
    })

    // Add second contact (isPrimary conflict)
    fireEvent.click(screen.getByText('catechists.create.contacts.add'))
    valueInput = screen.getByLabelText(/profile\.contacts\.col\.value/)
    fireEvent.change(valueInput, { target: { value: '84988888888' } })
    const isPrimaryCheckboxes = screen.getAllByLabelText(
      'profile.contacts.col.isPrimary',
    )
    fireEvent.click(isPrimaryCheckboxes[isPrimaryCheckboxes.length - 1])
    fireEvent.click(screen.getAllByText('common.save')[0])

    await waitFor(() => {
      expect(screen.getByText('+84988888888')).toBeInTheDocument()
    })

    // Test delete first contact
    const moreActions = screen.getAllByText('common.moreActions')
    fireEvent.click(moreActions[0]) // Open dropdown for first contact
    fireEvent.click(screen.getByText('common.delete'))

    await waitFor(() => {
      expect(screen.queryByText('+84901234567')).not.toBeInTheDocument()
    })
  })

  test('valid submit calls mutations correctly', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const createMutationMock = vi.fn().mockResolvedValue('newCatechistId')
    const upsertAddressMutationMock = vi.fn().mockResolvedValue(undefined)
    const addContactMutationMock = vi.fn().mockResolvedValue(undefined)

    vi.mocked(useMutation).mockImplementation(((mutationRef: any) => {
      const path = mutationRef?.[Symbol.for('functionName')]
      if (path === 'catechists:create') return createMutationMock as any
      if (path === 'catechists:upsertMyAddress')
        return upsertAddressMutationMock as any
      if (path === 'catechists:addContact') return addContactMutationMock as any
      return vi.fn() as any
    }) as any)

    const CreatePage = (Route as any).options.component
    render(<CreatePage />)

    // Fill Personal Info
    fireEvent.change(screen.getByLabelText(/profile\.personal\.fullName/), {
      target: { value: 'Test User' },
    })

    const roleSelect = screen
      .getByText('catechists.role.placeholder')
      .closest('select')!
    fireEvent.change(roleSelect, { target: { value: 'admin' } })

    // Fill Address
    fireEvent.change(screen.getByLabelText('profile.address.city'), {
      target: { value: 'HCMC' },
    })

    // Add Contact
    fireEvent.click(screen.getByText('catechists.create.contacts.add'))
    const valueInput = screen.getByLabelText(/profile\.contacts\.col\.value/)
    fireEvent.change(valueInput, { target: { value: '84901234567' } })
    fireEvent.blur(valueInput)
    fireEvent.click(screen.getAllByText('common.save')[0])

    await waitFor(() => {
      expect(
        screen.queryByText('profile.contacts.addContact'),
      ).not.toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'catechists.create.title' }),
    )

    await waitFor(() => {
      expect(createMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'admin123',
          fullName: 'Test User',
          role: 'admin',
        }),
      )
      expect(upsertAddressMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          catechistId: 'newCatechistId',
          country: DEFAULT_COUNTRY,
          city: 'HCMC',
        }),
      )
      expect(addContactMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          catechistId: 'newCatechistId',
          value: '+84901234567',
        }),
      )
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/catechists/$id',
        params: { id: 'newCatechistId' },
      })
    })
  })
})
