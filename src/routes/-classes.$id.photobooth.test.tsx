import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { useParams } from '@tanstack/react-router'
import * as React from 'react'
import { Route } from './classes.$id.photobooth'
import type * as UsePhotoboothQueueModule from '~/hooks/use-photobooth-queue'
import { useAuth } from '~/lib/auth'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { usePhotoboothQueue } from '~/hooks/use-photobooth-queue'

// Default to the real hook so most tests exercise genuine queue behavior;
// the "reaching the end of the queue" test below overrides it directly,
// since the real hook only reaches isDone once every student is *confirmed*
// (skip alone just reorders), so it can't produce a non-empty
// missingStudents list at completion — that's a rendering concern of the
// summary screen, tested in isolation here.
vi.mock('~/hooks/use-photobooth-queue', async (importOriginal) => {
  const actual = await importOriginal<typeof UsePhotoboothQueueModule>()
  return { ...actual, usePhotoboothQueue: vi.fn(actual.usePhotoboothQueue) }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useParams: vi.fn(),
    Navigate: vi.fn(({ to }: { to: string }) =>
      React.createElement('div', { 'data-testid': 'navigate', 'data-to': to }),
    ),
    Link: vi.fn(({ to, children, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
    ),
  }
})

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
  useInactiveYear: vi.fn(),
}))

vi.mock('~/lib/image', () => ({
  compressAndResizeImage: vi.fn((file: File) => Promise.resolve(file)),
}))

vi.mock('~/components/custom/profile-avatar', () => ({
  ProfileAvatar: ({ fullName }: { fullName: string }) => (
    <div data-testid="profile-avatar">{fullName}</div>
  ),
}))

vi.mocked(useParams).mockReturnValue({ id: 'class123' })

const mockGenerateUploadUrl = vi.fn()
const mockUpdatePhoto = vi.fn()

function mockUseQuery(classDetails: unknown) {
  vi.mocked(useQuery).mockImplementation((query: any, ..._args: Array<any>) => {
    const name = query?.[Symbol.for('functionName')]
    if (name === 'appConfig:get') return { nameFormat: 'firstName_lastName' }
    if (name === 'students:getProfilePhotoUrl') return null
    return classDetails
  })
}

// Student missing a photo -> should be queued first per missing-photo-first ordering.
const studentMissingPhoto = {
  _id: 'student1',
  fullName: 'Trần Thị B',
  saintName: 'Mary',
  profilePhotoStorageId: undefined,
}

const studentWithPhoto = {
  _id: 'student2',
  fullName: 'Nguyễn Văn C',
  saintName: 'Peter',
  profilePhotoStorageId: 'storage1',
}

function buildClassDetails(
  students: Array<{
    _id: string
    fullName: string
    saintName: string
    profilePhotoStorageId: string | undefined
  }>,
  canManageEnrollments = true,
) {
  return {
    class: { _id: 'class123', name: 'Ấu Nhi 1' },
    canManageEnrollments,
    students: students.map((student) => ({
      enrollment: { status: 'active' as const },
      student,
    })),
  }
}

describe('PhotoboothPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParams).mockReturnValue({ id: 'class123' })
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year123',
    } as any)
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: null,
    })
    vi.mocked(useAuth).mockReturnValue({
      user: { userDocId: 'catechist123', accountType: 'catechist' },
      isHydrated: true,
    } as any)
    vi.mocked(useMutation).mockImplementation(((apiRef: any) => {
      const path = apiRef?.[Symbol.for('functionName')] || ''
      if (path.includes('generateUploadUrl')) return mockGenerateUploadUrl
      if (path.includes('updateProfilePhoto')) return mockUpdatePhoto
      return vi.fn()
    }) as any)
  })

  function renderPage() {
    const PhotoboothPage = (Route as any).options.component
    return render(<PhotoboothPage />)
  }

  it('renders the first-in-queue student name (missing photo first)', () => {
    mockUseQuery(buildClassDetails([studentWithPhoto, studentMissingPhoto]))

    renderPage()

    expect(screen.getByText('Mary Trần Thị B')).toBeInTheDocument()
    expect(screen.queryByText('Peter Nguyễn Văn C')).not.toBeInTheDocument()
  })

  it('redirects when catechist lacks canManageEnrollments', () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto], false))

    renderPage()

    const navigate = screen.getByTestId('navigate')
    expect(navigate).toHaveAttribute('data-to', '/classes/$id')
    expect(screen.queryByText('Mary Trần Thị B')).not.toBeInTheDocument()
  })

  it('redirects when the academic year is inactive', () => {
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: true,
      yearName: '2023-2024',
    })
    mockUseQuery(buildClassDetails([studentMissingPhoto], true))

    renderPage()

    expect(screen.getByTestId('navigate')).toHaveAttribute(
      'data-to',
      '/classes/$id',
    )
  })

  it('shows a full-screen preview with retake and use-photo actions after selecting a file', async () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto]))
    renderPage()

    const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: 'Trần Thị B' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('photobooth.retake')).toBeInTheDocument()
    expect(screen.getByText('photobooth.usePhoto')).toBeInTheDocument()
  })

  it('clicking retake clears the preview and re-shows capture UI', async () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto]))
    renderPage()

    const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: 'Trần Thị B' }),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('photobooth.retake'))

    expect(
      screen.queryByRole('img', { name: 'Trần Thị B' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('photobooth.capture')).toBeInTheDocument()
  })

  it('use photo uploads and advances the queue to the next student', async () => {
    mockGenerateUploadUrl.mockResolvedValue('https://convex.upload/url')
    mockUpdatePhoto.mockResolvedValue({})
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: 'newStorageId' }),
    } as any)

    mockUseQuery(buildClassDetails([studentMissingPhoto, studentWithPhoto]))
    renderPage()

    const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('photobooth.usePhoto')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('photobooth.usePhoto'))

    await waitFor(() => {
      expect(mockUpdatePhoto).toHaveBeenCalledWith({
        requesterId: 'catechist123',
        studentId: 'student1',
        storageId: 'newStorageId',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Peter Nguyễn Văn C')).toBeInTheDocument()
    })
  })

  it('skip advances to the next student without calling the upload mutation', () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto, studentWithPhoto]))
    renderPage()

    expect(screen.getByText('Mary Trần Thị B')).toBeInTheDocument()
    fireEvent.click(screen.getByText('photobooth.skip'))

    expect(screen.getByText('Peter Nguyễn Văn C')).toBeInTheDocument()
    expect(mockGenerateUploadUrl).not.toHaveBeenCalled()
    expect(mockUpdatePhoto).not.toHaveBeenCalled()
  })

  it('shows the summary screen with captured count and total once the queue is done', () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto]))
    vi.mocked(usePhotoboothQueue).mockReturnValue({
      current: null,
      isDone: true,
      total: 1,
      confirmedCount: 1,
      missingStudents: [],
      skip: vi.fn(),
      confirm: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('photobooth.summary.title')).toBeInTheDocument()
    expect(screen.getByText('photobooth.summary.captured')).toBeInTheDocument()
    expect(
      screen.queryByText('photobooth.summary.stillMissing'),
    ).not.toBeInTheDocument()
  })

  it('lists still-missing students on the summary screen when the session ends with some unconfirmed', () => {
    mockUseQuery(buildClassDetails([studentMissingPhoto]))
    vi.mocked(usePhotoboothQueue).mockReturnValue({
      current: null,
      isDone: true,
      total: 2,
      confirmedCount: 1,
      missingStudents: [
        {
          studentId: 'student1',
          fullName: 'Trần Thị B',
          saintName: 'Mary',
          hasPhoto: false,
        },
      ],
      skip: vi.fn(),
      confirm: vi.fn(),
    })

    renderPage()

    expect(
      screen.getByText('photobooth.summary.stillMissing'),
    ).toBeInTheDocument()
    expect(screen.getByText('Mary Trần Thị B')).toBeInTheDocument()
  })
})
