import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// romcal's real `generateCalendar` computation is fast (~70ms for a full
// year) so we exercise the real package rather than mocking it — this also
// verifies the wrapper's date-key/name-shape assumptions against the real
// library output.
import { Romcal } from 'romcal'

describe('romcal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  test('getLiturgicalDayMap computes and caches a year on first call', async () => {
    const { getLiturgicalDayMap } = await import('./romcal')

    const map = await getLiturgicalDayMap(2024)

    expect(map['2024-12-25']?.name).toContain('Nativity')
    expect(map['2024-12-25']?.colorName).not.toBeNull()
    expect(map['2024-01-01']).toBeDefined()
    // persisted to localStorage under the expected key
    const raw = localStorage.getItem(
      'giaoly_romcal_vietnam_en_v2_2024_true_true_true',
    )
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)['2024-12-25']).toEqual(map['2024-12-25'])
  })

  test('second call for the same year hits the in-memory cache without recomputing', async () => {
    const { getLiturgicalDayMap } = await import('./romcal')

    const spy = vi.spyOn(Romcal.prototype, 'generateCalendar')

    const first = await getLiturgicalDayMap(2024)
    expect(spy).toHaveBeenCalledTimes(1)

    const second = await getLiturgicalDayMap(2024)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  test('localStorage persistence round-trip: a fresh module load reads from storage instead of recomputing', async () => {
    const mod1 = await import('./romcal')
    await mod1.getLiturgicalDayMap(2025)

    const raw = localStorage.getItem(
      'giaoly_romcal_vietnam_en_v2_2025_true_true_true',
    )
    expect(raw).not.toBeNull()

    // Reset the module registry to clear the in-memory Map cache, but keep
    // localStorage intact, then re-import and spy on the real computation.
    vi.resetModules()
    const spy = vi.spyOn(Romcal.prototype, 'generateCalendar')
    const mod2 = await import('./romcal')

    const map = await mod2.getLiturgicalDayMap(2025)

    expect(spy).not.toHaveBeenCalled()
    expect(map['2025-12-25']).toBeDefined()
  })

  test('getLiturgicalDateLabel returns null for a malformed date', async () => {
    const { getLiturgicalDateLabel } = await import('./romcal')

    const result = await getLiturgicalDateLabel('not-a-date')

    expect(result).toBeNull()
  })

  test('getLiturgicalDateLabel returns the correct name for a known date', async () => {
    const { getLiturgicalDateLabel } = await import('./romcal')

    const result = await getLiturgicalDateLabel('2024-12-25')

    expect(result).toContain('Nativity')
  })

  test('getLiturgicalDateLabel returns null when the date has no liturgical entry in the map', async () => {
    const { getLiturgicalDateLabel } = await import('./romcal')

    const result = await getLiturgicalDateLabel('2024-99-99')

    // Out-of-range/nonexistent calendar date: not present as a key in the
    // generated map, so falls back to null via the `map[isoDate] ?? null`.
    expect(result).toBeNull()
  })

  test('readFromStorage catches JSON.parse errors and returns null', async () => {
    const { getLiturgicalDayMap } = await import('./romcal')

    // Corrupt localStorage with invalid JSON
    localStorage.setItem(
      'giaoly_romcal_vietnam_en_v2_2024_true_true_true',
      '{invalid json}',
    )

    const spy = vi.spyOn(Romcal.prototype, 'generateCalendar')

    const map = await getLiturgicalDayMap(2024)

    // Should regenerate from Romcal instead of reading corrupted storage
    expect(spy).toHaveBeenCalled()
    expect(map['2024-12-25']).toBeDefined()

    spy.mockRestore()
  })

  test('writeToStorage catches errors gracefully', async () => {
    const { getLiturgicalDayMap } = await import('./romcal')

    // Mock localStorage.setItem to throw
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    const map = await getLiturgicalDayMap(2025)

    // Should still return the map even if storage write fails
    expect(map['2025-12-25']).toBeDefined()
    expect(setItemSpy).toHaveBeenCalled()

    setItemSpy.mockRestore()
  })

  test('getRomcalInstance recreates instance when options change', async () => {
    const { getLiturgicalDayMap } = await import('./romcal')

    const spyGenerate = vi.spyOn(Romcal.prototype, 'generateCalendar')

    // First call with default options
    await getLiturgicalDayMap(2024, {
      epiphanyOnSunday: true,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })

    expect(spyGenerate).toHaveBeenCalledTimes(1)

    // Second call with different options — should create new instance
    await getLiturgicalDayMap(2024, {
      epiphanyOnSunday: false,
      corpusChristiOnSunday: true,
      ascensionOnSunday: true,
    })

    expect(spyGenerate).toHaveBeenCalledTimes(2)

    spyGenerate.mockRestore()
  })

  test('getLiturgicalDateLabel returns null for non-finite year number', async () => {
    const { getLiturgicalDateLabel } = await import('./romcal')

    const result = await getLiturgicalDateLabel('abcd-01-01')

    expect(result).toBeNull()
  })

  test('getLiturgicalDateLabel handles edge case year values', async () => {
    const { getLiturgicalDateLabel } = await import('./romcal')

    // Test year "0" (which is a valid finite number)
    const result = await getLiturgicalDateLabel('0000-01-01')

    expect(result).toBeNull() // not in any computed calendar, but parsing succeeds
  })
})
