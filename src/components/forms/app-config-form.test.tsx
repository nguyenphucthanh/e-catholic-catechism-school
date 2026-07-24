import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { AppConfigForm } from './app-config-form'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AppConfigForm', () => {
  const requesterId = 'catechist123' as any
  const mockUpsertMutation = vi.fn()
  const mockGenerateUploadUrlMutation = vi.fn()
  const mockOnSuccess = vi.fn()

  const initialValues = {
    troopName: 'Đoàn TNTT',
    parishName: 'Giáo xứ A',
    dioceseName: 'Giáo phận B',
    nameFormat: 'firstName_lastName' as const,
    logoStorageId: 'storage123' as any,
    logoUrl: 'https://example.com/logo.png',
    epiphanyOnSunday: true,
    corpusChristiOnSunday: true,
    ascensionOnSunday: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders form with initial values', () => {
    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    expect(screen.getByLabelText('appConfig.fields.troopName')).toHaveValue(
      'Đoàn TNTT',
    )
    expect(screen.getByLabelText(/appConfig.fields.parishName/)).toHaveValue(
      'Giáo xứ A',
    )
    expect(screen.getByLabelText(/appConfig.fields.dioceseName/)).toHaveValue(
      'Giáo phận B',
    )
    expect(screen.getByAltText('Logo preview')).toHaveAttribute(
      'src',
      'https://example.com/logo.png',
    )
  })

  test('handles form submission successfully without new file upload', async () => {
    mockUpsertMutation.mockResolvedValue({})

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpsertMutation).toHaveBeenCalledWith({
        requesterId,
        troopName: 'Đoàn TNTT',
        parishName: 'Giáo xứ A',
        dioceseName: 'Giáo phận B',
        nameFormat: 'firstName_lastName',
        epiphanyOnSunday: true,
        corpusChristiOnSunday: true,
        ascensionOnSunday: true,
        logoStorageId: 'storage123',
      })
      expect(toast.success).toHaveBeenCalledWith('appConfig.saved')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  test('handles form submission error gracefully', async () => {
    mockUpsertMutation.mockRejectedValue(new Error('Mutation failed'))

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('appConfig.saveError')
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })
  })

  test('does not submit when required fields are empty', async () => {
    render(
      <AppConfigForm
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpsertMutation).not.toHaveBeenCalled()
    })
  })

  test('toggles switches and radio group values', async () => {
    mockUpsertMutation.mockResolvedValue({})

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const epiphanySwitch = screen.getByRole('switch', {
      name: 'appConfig.fields.epiphanyOnSunday',
    })
    fireEvent.click(epiphanySwitch)

    const lastNameRadio = screen.getByRole('radio', {
      name: 'appConfig.fields.nameFormat.lastName_firstName',
    })
    fireEvent.click(lastNameRadio)

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpsertMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          epiphanyOnSunday: false,
          nameFormat: 'lastName_firstName',
        }),
      )
    })
  })

  test('handles logo removal', async () => {
    mockUpsertMutation.mockResolvedValue({})

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const removeBtn = screen.getByRole('button', {
      name: 'appConfig.fields.logo.remove',
    })
    fireEvent.click(removeBtn)

    expect(screen.queryByAltText('Logo preview')).toBeNull()

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockUpsertMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          logoStorageId: null,
        }),
      )
    })
  })

  test('handles logo file change and successful upload on submit', async () => {
    mockGenerateUploadUrlMutation.mockResolvedValue(
      'https://upload.example.com',
    )
    mockUpsertMutation.mockResolvedValue({})

    const originalCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = vi
      .fn()
      .mockReturnValue('blob:http://localhost/fake-blob')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: 'new_storage_id' }),
    }) as any

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const fileInput = screen.getByLabelText('appConfig.fields.logo')
    const file = new File(['dummy content'], 'logo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockGenerateUploadUrlMutation).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith('https://upload.example.com', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: file,
      })
      expect(mockUpsertMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          logoStorageId: 'new_storage_id',
        }),
      )
    })

    URL.createObjectURL = originalCreateObjectURL
  })

  test('handles upload error on submit', async () => {
    mockGenerateUploadUrlMutation.mockResolvedValue(
      'https://upload.example.com',
    )
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as any

    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const fileInput = screen.getByLabelText('appConfig.fields.logo')
    const file = new File(['dummy content'], 'logo.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const saveBtn = screen.getByRole('button', { name: 'common.save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('appConfig.saveError')
      expect(mockUpsertMutation).not.toHaveBeenCalled()
    })
  })

  test('cancel button calls onSuccess when form is clean', () => {
    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const cancelBtn = screen.getByRole('button', { name: 'common.cancel' })
    fireEvent.click(cancelBtn)

    expect(mockOnSuccess).toHaveBeenCalled()
  })

  test('cancel button opens confirmation dialog when form is dirty', () => {
    render(
      <AppConfigForm
        initialValues={initialValues}
        requesterId={requesterId}
        upsertMutation={mockUpsertMutation}
        generateUploadUrlMutation={mockGenerateUploadUrlMutation}
        onSuccess={mockOnSuccess}
      />,
    )

    const troopInput = screen.getByLabelText('appConfig.fields.troopName')
    fireEvent.change(troopInput, { target: { value: 'New Troop' } })

    const cancelBtn = screen.getByRole('button', { name: 'common.cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument()

    const discardBtn = screen.getByRole('button', { name: 'Discard' })
    fireEvent.click(discardBtn)

    expect(mockOnSuccess).toHaveBeenCalled()
  })
})
