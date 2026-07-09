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

    expect(map['2024-12-25']).toContain('Nativity')
    expect(map['2024-01-01']).toBeDefined()
    // persisted to localStorage under the expected key
    const raw = localStorage.getItem(
      'giaoly_romcal_vietnam_en_2024_true_true_true',
    )
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)['2024-12-25']).toBe(map['2024-12-25'])
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
      'giaoly_romcal_vietnam_en_2025_true_true_true',
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
})
