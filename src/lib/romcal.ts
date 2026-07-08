import { Romcal } from 'romcal'
import { Vietnam_En } from '@romcal/calendar.vietnam'

// romcal ships no Vietnamese (`vi`) locale for the Vietnam calendar plugin —
// only English-localized names are available. The liturgical-date field this
// feeds is editable with a hint telling users to double check/translate it.
type LiturgicalDayMap = Record<string, string>

const STORAGE_PREFIX = 'giaoly_romcal_vietnam_en_'

const memoryCache = new Map<number, LiturgicalDayMap>()
let romcalInstance: Romcal | null = null

function getRomcalInstance(): Romcal {
  if (!romcalInstance) {
    romcalInstance = new Romcal({ localizedCalendar: Vietnam_En })
  }
  return romcalInstance
}

function readFromStorage(year: number): LiturgicalDayMap | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${year}`)
    return raw ? (JSON.parse(raw) as LiturgicalDayMap) : null
  } catch {
    return null
  }
}

function writeToStorage(year: number, data: LiturgicalDayMap) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${year}`, JSON.stringify(data))
  } catch {
    // storage full or unavailable — in-memory cache still applies this session
  }
}

export async function getLiturgicalDayMap(
  year: number,
): Promise<LiturgicalDayMap> {
  const cached = memoryCache.get(year)
  if (cached) return cached

  const stored = readFromStorage(year)
  if (stored) {
    memoryCache.set(year, stored)
    return stored
  }

  const calendar = await getRomcalInstance().generateCalendar(year)
  const map: LiturgicalDayMap = {}
  for (const [date, days] of Object.entries(calendar)) {
    if (days.length > 0) map[date] = days[0].name
  }

  memoryCache.set(year, map)
  writeToStorage(year, map)
  return map
}

// isoDate must be `YYYY-MM-DD`. Returns null if outside a computable range.
export async function getLiturgicalDateLabel(
  isoDate: string,
): Promise<string | null> {
  const year = Number(isoDate.slice(0, 4))
  if (!Number.isFinite(year)) return null
  const map = await getLiturgicalDayMap(year)
  return map[isoDate] ?? null
}
