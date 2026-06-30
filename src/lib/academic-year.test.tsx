import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { useQuery } from 'convex/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AcademicYearProvider, useSelectedAcademicYear } from './academic-year'

const YEAR_KEY = 'giaoly_selected_year'

const ACTIVE_YEAR = {
  _id: 'year_active',
  name: '2025-2026',
  startDate: '2025-09-01',
  endDate: '2026-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: true,
  isDeleted: false,
}

const OTHER_YEAR = {
  _id: 'year_other',
  name: '2024-2025',
  startDate: '2024-09-01',
  endDate: '2025-05-31',
  timezone: 'Asia/Ho_Chi_Minh',
  isActive: false,
  isDeleted: false,
}

function mockQueries({ active, list }: { active: unknown; list: unknown }) {
  vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
    const path = queryRef?.[Symbol.for('functionName')]
    if (path === 'academicYears:getActive') return active
    if (path === 'academicYears:list') return list
    return undefined
  })
}

function Consumer() {
  const { selectedYearId, setSelectedYearId } = useSelectedAcademicYear()
  return (
    <div>
      <span data-testid="selected-year-id">{selectedYearId ?? 'null'}</span>
      <button onClick={() => setSelectedYearId('year_other' as any)}>
        select-other
      </button>
      <button onClick={() => setSelectedYearId(null)}>clear</button>
    </div>
  )
}

describe('AcademicYearProvider / useSelectedAcademicYear', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.mocked(useQuery).mockReset()
    localStorage.clear()
  })

  test('with nothing in localStorage, selects active year and persists it once queries resolve', async () => {
    mockQueries({ active: ACTIVE_YEAR, list: [ACTIVE_YEAR, OTHER_YEAR] })

    render(
      <AcademicYearProvider>
        <Consumer />
      </AcademicYearProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('selected-year-id')).toHaveTextContent(
        'year_active',
      )
    })
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_active')
  })

  test('keeps a valid persisted id even when it differs from the active year', async () => {
    localStorage.setItem(YEAR_KEY, 'year_other')
    mockQueries({ active: ACTIVE_YEAR, list: [ACTIVE_YEAR, OTHER_YEAR] })

    render(
      <AcademicYearProvider>
        <Consumer />
      </AcademicYearProvider>,
    )

    // Give effects a chance to run.
    await waitFor(() => {
      expect(screen.getByTestId('selected-year-id')).toHaveTextContent(
        'year_other',
      )
    })
    // Must not be overwritten by the active year.
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_other')
  })

  test('regression: falls back to active year when persisted id is stale (no longer in list)', async () => {
    localStorage.setItem(YEAR_KEY, 'year_deleted')
    mockQueries({ active: ACTIVE_YEAR, list: [ACTIVE_YEAR, OTHER_YEAR] })

    render(
      <AcademicYearProvider>
        <Consumer />
      </AcademicYearProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('selected-year-id')).toHaveTextContent(
        'year_active',
      )
    })
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_active')
  })

  test('does not overwrite selection while queries are still loading (undefined)', () => {
    localStorage.setItem(YEAR_KEY, 'year_other')
    mockQueries({ active: undefined, list: undefined })

    render(
      <AcademicYearProvider>
        <Consumer />
      </AcademicYearProvider>,
    )

    expect(screen.getByTestId('selected-year-id')).toHaveTextContent(
      'year_other',
    )
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_other')
  })

  test('setSelectedYearId updates context value and localStorage', async () => {
    mockQueries({ active: ACTIVE_YEAR, list: [ACTIVE_YEAR, OTHER_YEAR] })

    const { result } = renderHook(() => useSelectedAcademicYear(), {
      wrapper: AcademicYearProvider,
    })

    await waitFor(() => {
      expect(result.current.selectedYearId).toBe('year_active')
    })

    act(() => {
      result.current.setSelectedYearId('year_other' as any)
    })

    expect(result.current.selectedYearId).toBe('year_other')
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_other')
  })

  test('setSelectedYearId(null) removes the localStorage key', () => {
    // No active year, so the auto-fallback effect has nothing to fall back
    // to and won't immediately repopulate the selection after it's cleared.
    mockQueries({ active: null, list: [ACTIVE_YEAR, OTHER_YEAR] })

    const { result } = renderHook(() => useSelectedAcademicYear(), {
      wrapper: AcademicYearProvider,
    })

    act(() => {
      result.current.setSelectedYearId('year_other' as any)
    })

    expect(result.current.selectedYearId).toBe('year_other')
    expect(localStorage.getItem(YEAR_KEY)).toBe('year_other')

    act(() => {
      result.current.setSelectedYearId(null)
    })

    expect(result.current.selectedYearId).toBeNull()
    expect(localStorage.getItem(YEAR_KEY)).toBeNull()
  })

  test('falls back to null when reading localStorage throws on init', () => {
    mockQueries({ active: null, list: [] })
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('access denied')
      })

    const { result } = renderHook(() => useSelectedAcademicYear(), {
      wrapper: AcademicYearProvider,
    })

    expect(result.current.selectedYearId).toBeNull()

    getItemSpy.mockRestore()
  })

  test('useSelectedAcademicYear throws when used outside AcademicYearProvider', () => {
    // Suppress the expected React error boundary console noise.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useSelectedAcademicYear())).toThrow(
      'useSelectedAcademicYear must be used within AcademicYearProvider',
    )

    consoleSpy.mockRestore()
  })
})
