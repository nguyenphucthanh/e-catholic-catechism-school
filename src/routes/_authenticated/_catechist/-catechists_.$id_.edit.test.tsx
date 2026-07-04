import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Route } from './catechists_.$id_.edit'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  }
})

vi.mock('~/lib/permissions', () => ({
  isAdmin: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useQuery).mockClear()
  vi.mocked(useMutation).mockReturnValue(vi.fn() as any)
  vi.mocked(useParams).mockReturnValue({ id: 'catechist123' })
  vi.mocked(toast.success).mockClear()
  vi.mocked(useNavigate).mockReturnValue(vi.fn())
})

const mockCatechist = {
  _id: 'catechist123',
  memberId: 'GLV0001',
  fullName: 'Nguyễn Văn A',
  saintName: 'Giuse',
  role: 'user',
  isActive: true,
  address: null,
  contacts: [],
}

describe('EditCatechistPage', () => {
  test('redirects non-admin (renders unauthorized)', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'user123', role: 'user' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyContacts') return []
      return mockCatechist
    }) as any)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    expect(screen.getByText('common.contactAdmin')).toBeInTheDocument()
  })

  test('clean form navigates directly on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyContacts') return []
      return mockCatechist
    }) as any)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/catechists/$id',
      params: { id: 'catechist123' },
    })
    expect(
      screen.queryByText('catechists.confirmLeave.title'),
    ).not.toBeInTheDocument()
  })

  test('dirty form shows AlertDialog on cancel', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyContacts') return []
      return mockCatechist
    }) as any)
    const navigateMock = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigateMock)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    // Make form dirty
    const nameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    const cancelBtn = screen.getByText('common.cancel')
    fireEvent.click(cancelBtn)

    expect(navigateMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('catechists.confirmLeave.title'),
    ).toBeInTheDocument()
  })

  test('personal info form submits with correct args', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyContacts') return []
      return mockCatechist
    }) as any)

    const updateMutationMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(((mutationRef: any) => {
      const path = mutationRef?.[Symbol.for('functionName')]
      if (path === 'catechists:update') return updateMutationMock as any
      return vi.fn() as any
    }) as any)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    const nameInput = screen.getByLabelText(/profile\.personal\.fullName/)
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    // Find the save button within the Personal Info form section.
    // Easiest is to target the submit button that is near the FullName
    const saveBtns = screen.getAllByText('common.save')
    fireEvent.click(saveBtns[0])

    await waitFor(() => {
      expect(updateMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'admin123',
          catechistId: 'catechist123',
          fullName: 'Updated Name',
        }),
      )
    })
  })

  test('can add a contact', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'admin123', role: 'admin' },
    } as any)
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.mocked(useQuery).mockImplementation(((queryRef: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'catechists:getMyContacts') return []
      return mockCatechist
    }) as any)

    const addContactMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useMutation).mockImplementation(((mutationRef: any) => {
      const path = mutationRef?.[Symbol.for('functionName')]
      if (path === 'catechists:addContact') return addContactMock as any
      return vi.fn() as any
    }) as any)

    const EditPage = (Route as any).options.component
    render(<EditPage />)

    fireEvent.click(screen.getByText('profile.contacts.add'))

    const labelInput = screen.getByLabelText(/profile\.contacts\.col\.label/)
    fireEvent.change(labelInput, { target: { value: 'Mobile' } })

    const valueInput = screen.getByPlaceholderText(
      'profile.contacts.value.placeholder',
    )
    fireEvent.change(valueInput, { target: { value: '84901234567' } })

    const saveBtns = screen.getAllByText('common.save')
    fireEvent.click(saveBtns[saveBtns.length - 1])

    await waitFor(() => {
      expect(addContactMock).toHaveBeenCalled()
    })
  })
})
