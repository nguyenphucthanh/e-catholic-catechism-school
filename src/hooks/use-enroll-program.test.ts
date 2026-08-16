import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { useEnrollProgram } from './use-enroll-program'

const mockEnrollProgram = vi.fn()
const mockUnenrollProgram = vi.fn()

vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
  const path = fnRef?.[Symbol.for('functionName')]
  if (path === 'extracurricularPrograms:enrollProgram') return mockEnrollProgram
  if (path === 'extracurricularPrograms:unenrollProgram')
    return mockUnenrollProgram
  return vi.fn()
}) as any)

describe('useEnrollProgram hook', () => {
  beforeEach(() => {
    mockEnrollProgram.mockReset()
    mockUnenrollProgram.mockReset()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it('calls enrollProgram with the requesterId when provided', async () => {
    mockEnrollProgram.mockResolvedValue(undefined)
    const onEnrolled = vi.fn()
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        requesterId: 'cat1' as any,
        onEnrolled,
      }),
    )

    await act(async () => {
      await result.current.handleEnroll()
    })

    expect(mockEnrollProgram).toHaveBeenCalledWith({
      programId: 'prog1',
      requesterId: 'cat1',
      studentRequesterId: undefined,
    })
    expect(toast.success).toHaveBeenCalledWith(
      'extracurricular.enrolledSuccess',
    )
    expect(onEnrolled).toHaveBeenCalledTimes(1)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('calls enrollProgram with the studentRequesterId when provided', async () => {
    mockEnrollProgram.mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        studentRequesterId: 'stu1' as any,
      }),
    )

    await act(async () => {
      await result.current.handleEnroll()
    })

    expect(mockEnrollProgram).toHaveBeenCalledWith({
      programId: 'prog1',
      requesterId: undefined,
      studentRequesterId: 'stu1',
    })
  })

  it('shows an error toast and does not call onEnrolled when enrollProgram fails', async () => {
    mockEnrollProgram.mockRejectedValue(
      new Error('errors.extracurricularCapacityExceeded'),
    )
    const onEnrolled = vi.fn()
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        requesterId: 'cat1' as any,
        onEnrolled,
      }),
    )

    await act(async () => {
      await result.current.handleEnroll()
    })

    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onEnrolled).not.toHaveBeenCalled()
    expect(result.current.isSubmitting).toBe(false)
  })

  it('does not call enrollProgram when neither requesterId nor studentRequesterId is provided', async () => {
    const onEnrolled = vi.fn()
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        onEnrolled,
      }),
    )

    await act(async () => {
      await result.current.handleEnroll()
    })

    expect(mockEnrollProgram).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onEnrolled).not.toHaveBeenCalled()
  })

  it('calls unenrollProgram and shows a success toast on success', async () => {
    mockUnenrollProgram.mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        requesterId: 'cat1' as any,
      }),
    )

    await act(async () => {
      await result.current.handleUnenroll()
    })

    expect(mockUnenrollProgram).toHaveBeenCalledWith({
      programId: 'prog1',
      requesterId: 'cat1',
      studentRequesterId: undefined,
    })
    expect(toast.success).toHaveBeenCalledWith(
      'extracurricular.unenrolledSuccess',
    )
    expect(result.current.isSubmitting).toBe(false)
  })

  it('shows an error toast when unenrollProgram fails', async () => {
    mockUnenrollProgram.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        studentRequesterId: 'stu1' as any,
      }),
    )

    await act(async () => {
      await result.current.handleUnenroll()
    })

    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(result.current.isSubmitting).toBe(false)
  })

  it('does not call unenrollProgram when neither requesterId nor studentRequesterId is provided', async () => {
    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
      }),
    )

    await act(async () => {
      await result.current.handleUnenroll()
    })

    expect(mockUnenrollProgram).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('sets isSubmitting to true while the enroll mutation is in flight', async () => {
    let resolveMutation: () => void = () => undefined
    mockEnrollProgram.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve
        }),
    )

    const { result } = renderHook(() =>
      useEnrollProgram({
        programId: 'prog1' as any,
        requesterId: 'cat1' as any,
      }),
    )

    let enrollPromise!: Promise<void>
    act(() => {
      enrollPromise = result.current.handleEnroll()
    })

    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      resolveMutation()
      await enrollPromise
    })

    expect(result.current.isSubmitting).toBe(false)
  })
})
