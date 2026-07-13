import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { StudentPhotoUpload } from './student-photo-upload'

// Mock compressAndResizeImage helper
vi.mock('~/lib/image', () => ({
  compressAndResizeImage: vi.fn((file) => Promise.resolve(file)),
}))

describe('StudentPhotoUpload', () => {
  const mockGenerateUploadUrl = vi.fn()
  const mockUpdatePhoto = vi.fn()
  const mockDeletePhoto = vi.fn()
  const mockOnPhotoChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock the useQuery hook to return a mock photo URL by default
    vi.mocked(useQuery).mockReturnValue('https://example.com/student-photo.jpg')

    // Mock the useMutation hooks
    vi.mocked(useMutation).mockImplementation(((apiRef: any) => {
      const path = apiRef?.[Symbol.for('functionName')] || ''
      if (path.includes('generateUploadUrl')) {
        return mockGenerateUploadUrl
      }
      if (path.includes('updateProfilePhoto')) {
        return mockUpdatePhoto
      }
      if (path.includes('deleteProfilePhoto')) {
        return mockDeletePhoto
      }
      return vi.fn()
    }) as any)
  })

  it('renders with existing photo', () => {
    render(
      <StudentPhotoUpload
        requesterId={'catechists-1' as any}
        studentId={'students-1' as any}
        fullName="Jane Doe"
        onPhotoChange={mockOnPhotoChange}
      />,
    )

    expect(
      screen.getByText('profile.personal.photo.upload'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('profile.personal.photo.remove'),
    ).toBeInTheDocument()
  })

  it('handles image upload successfully', async () => {
    mockGenerateUploadUrl.mockResolvedValue('https://convex.upload/url')
    mockUpdatePhoto.mockResolvedValue({})

    // Mock global fetch
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ storageId: 'mock-storage-id' }),
    }
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(mockResponse as any)

    render(
      <StudentPhotoUpload
        requesterId={'catechists-1' as any}
        studentId={'students-1' as any}
        fullName="Jane Doe"
        onPhotoChange={mockOnPhotoChange}
      />,
    )

    const file = new File(['dummy content'], 'avatar.png', {
      type: 'image/png',
    })
    const input = document.querySelector('input[type="file"]')!

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://convex.upload/url',
        expect.any(Object),
      )
      expect(mockUpdatePhoto).toHaveBeenCalledWith({
        requesterId: 'catechists-1',
        studentId: 'students-1',
        storageId: 'mock-storage-id',
      })
      expect(mockOnPhotoChange).toHaveBeenCalledWith('mock-storage-id')
      expect(toast.success).toHaveBeenCalledWith('common.saved')
    })
  })

  it('handles image removal successfully', async () => {
    mockDeletePhoto.mockResolvedValue({})

    render(
      <StudentPhotoUpload
        requesterId={'catechists-1' as any}
        studentId={'students-1' as any}
        fullName="Jane Doe"
        onPhotoChange={mockOnPhotoChange}
      />,
    )

    const removeBtn = screen.getByText('profile.personal.photo.remove')
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(mockDeletePhoto).toHaveBeenCalledWith({
        requesterId: 'catechists-1',
        studentId: 'students-1',
      })
      expect(mockOnPhotoChange).toHaveBeenCalledWith(null)
      expect(toast.success).toHaveBeenCalledWith('common.saved')
    })
  })
})
