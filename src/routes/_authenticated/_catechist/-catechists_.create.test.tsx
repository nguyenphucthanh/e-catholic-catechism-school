import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAction } from 'convex/react'
import { Route } from './catechists_.create'
import { useAuth } from '~/lib/auth'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  createFileRoute: vi.fn(() => (options: any) => ({ options })),
}))

vi.mock('~/components/custom/catechist-photo-upload', () => ({
  CatechistPhotoUpload: () => <div />,
}))
vi.mock('~/components/forms/catechist-address-form', () => ({
  CatechistAddressFields: () => <div />,
}))
vi.mock('~/components/forms/catechist-personal-info-form', () => ({
  CatechistPersonalInfoFields: ({ form }: any) => (
    <button
      type="button"
      onClick={() => form.setFieldValue('fullName', 'Nguyen Van A')}
    >
      set-name
    </button>
  ),
}))
vi.mock('~/components/forms/catechist-contact-dialog-form', async () => {
  const actual = await vi.importActual<any>(
    '~/components/forms/catechist-contact-dialog-form',
  )
  const contact = { label: 'L', contactType: 'phone', value: '+84901234567' }
  return {
    ...actual,
    CatechistContactDialogForm: ({ onSubmit }: any) => (
      <div>
        <button
          onClick={() =>
            onSubmit({ ...contact, isPrimary: false, publicity: 'private' })
          }
        >
          save-private
        </button>
        <button
          onClick={() =>
            onSubmit({ ...contact, isPrimary: false, publicity: 'public' })
          }
        >
          save-public
        </button>
      </div>
    ),
  }
})

describe('CreateCatechistPage contact publicity', () => {
  const create = vi.fn()

  const stage = async (btn: string) => {
    render((Route as any).options.component())
    fireEvent.click(screen.getByText('catechists.create.contacts.add'))
    fireEvent.click(await screen.findByText(btn))
  }
  const submit = () => {
    fireEvent.click(screen.getByText('set-name'))
    fireEvent.click(screen.getAllByText('catechists.create.title').at(-1)!)
  }

  beforeEach(() => {
    create.mockReset().mockResolvedValue({
      catechistId: 'c1',
      credential: { loginId: '1', password: 'pw' },
    })
    vi.mocked(useAction).mockImplementation(((ref: any) =>
      ref?.[Symbol.for('functionName')] === 'catechists:createWithDetails'
        ? create
        : vi.fn()) as any)
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { _id: 'u1', userDocId: 'catechist-1', role: 'admin' } as any,
    })
  })

  test('shows Private badge for staged contact and submits publicity private', async () => {
    await stage('save-private')
    expect(
      await screen.findByText('profile.contacts.publicity.private'),
    ).toBeInTheDocument()
    submit()
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].contacts[0].publicity).toBe('private')
  })

  test('shows Public badge and submits publicity public', async () => {
    await stage('save-public')
    expect(
      await screen.findByText('profile.contacts.publicity.public'),
    ).toBeInTheDocument()
    submit()
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].contacts[0].publicity).toBe('public')
  })
})
