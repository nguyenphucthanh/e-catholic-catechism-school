import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CatechistContactsSection } from './catechist-contacts-section'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/forms/catechist-contact-dialog-form', () => ({
  CatechistContactDialogForm: ({ initialValues, onSubmit }: any) => (
    <div data-testid="contact-dialog-form">
      <span data-testid="dialog-mode">
        {initialValues ? 'edit' : 'add'}
      </span>
      <button onClick={() => onSubmit({ label: 'Test', contactType: 'phone', value: '+84901234567', isPrimary: false })}>
        submit-form
      </button>
      <button onClick={() => onSubmit({ label: 'Test', contactType: 'phone', value: '+84901234567', isPrimary: false })}>
        submit-form
      </button>
    </div>
  ),
  ContactTypeIcon: ({ type }: any) => <span data-testid="contact-icon">{type}</span>,
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

describe('CatechistContactsSection', () => {
  const mockCatechistId = 'catechist123' as Id<'catechists'>
  const mockContacts: Array<Doc<'catechistContacts'>> = [
    {
      _id: 'contact1' as Id<'catechistContacts'>,
      _creationTime: 1,
      catechistId: mockCatechistId,
      label: 'Personal Phone',
      contactType: 'phone',
      value: '+84912345678',
      isPrimary: true,
      isDeleted: false,
    },
    {
      _id: 'contact2' as Id<'catechistContacts'>,
      _creationTime: 2,
      catechistId: mockCatechistId,
      label: 'Email',
      contactType: 'email',
      value: 'test@example.com',
      isPrimary: false,
      isDeleted: false,
    },
  ]

  let mockAdd: any
  let mockUpdate: any
  let mockDelete: any

  beforeEach(() => {
    mockAdd = vi.fn().mockResolvedValue(undefined)
    mockUpdate = vi.fn().mockResolvedValue(undefined)
    mockDelete = vi.fn().mockResolvedValue(undefined)
  })

  test('renders skeleton when contacts is undefined', () => {
    const { container } = render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={undefined}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    expect(
      container.querySelector('[data-slot="skeleton"]'),
    ).toBeInTheDocument()
  })

  test('renders empty message when contacts list is empty', () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={[]}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    expect(screen.getByText('profile.contacts.empty')).toBeInTheDocument()
  })

  test('renders contact list items', () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    expect(screen.getByText('+84912345678')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('profile.contacts.primary')).toBeInTheDocument()
  })

  test('opens add dialog when add button is clicked', async () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    fireEvent.click(screen.getByText('profile.contacts.add'))

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.add'),
      ).toBeInTheDocument()
    })
  })

  test('opens edit dialog when edit menu item is clicked', async () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'common.moreActions' })[0])
    const editItem = await screen.findByText('common.edit')
    fireEvent.click(editItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.dialog.edit'),
      ).toBeInTheDocument()
    })
  })

  test('opens delete confirmation dialog', async () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'common.moreActions' })[0])
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })
  })

  test('calls deleteContact when delete is confirmed', async () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'common.moreActions' })[0])
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
      expect(mockDelete).toHaveBeenCalledWith({
        contactId: 'contact1',
      })
    })
  })

  test('cancel button in delete dialog closes it', async () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={mockContacts}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'common.moreActions' })[0])
    const deleteItem = await screen.findByText('common.delete')
    fireEvent.click(deleteItem)

    await waitFor(() => {
      expect(
        screen.getByText('profile.contacts.delete.title'),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('common.cancel'))

    await waitFor(() => {
      expect(
        screen.queryByText('profile.contacts.delete.title'),
      ).not.toBeInTheDocument()
    })
  })

  test('renders with custom title', () => {
    render(
      <CatechistContactsSection
        catechistId={mockCatechistId}
        contacts={[]}
        addContact={mockAdd}
        updateContact={mockUpdate}
        deleteContact={mockDelete}
        title="catechists.edit.contacts.title"
      />,
    )

    expect(screen.getByText('catechists.edit.contacts.title')).toBeInTheDocument()
  })
})