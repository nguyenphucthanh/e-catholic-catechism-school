import { Romcal } from 'romcal'
import { Vietnam_En } from '@romcal/calendar.vietnam'

// romcal ships no Vietnamese (`vi`) locale for the Vietnam calendar plugin —
// only English-localized names are available. The liturgical-date field this
// feeds is editable with a hint telling users to double check/translate it.
export interface LiturgicalDayInfo {
  name: string
  colorName: string | null
}

export type LiturgicalDayMap = Partial<Record<string, LiturgicalDayInfo>>

export interface RomcalOptions {
  epiphanyOnSunday: boolean
  corpusChristiOnSunday: boolean
  ascensionOnSunday: boolean
}

const DEFAULT_OPTIONS: RomcalOptions = {
  epiphanyOnSunday: true,
  corpusChristiOnSunday: true,
  ascensionOnSunday: true,
}

const STORAGE_PREFIX = 'giaoly_romcal_vietnam_en_v2_'

// cache keyed by `${year}_${epiphany}${corpusChristi}${ascension}` — options change the computed calendar
const memoryCache = new Map<string, LiturgicalDayMap>()
let romcalInstance: Romcal | null = null
let romcalInstanceOptions: RomcalOptions | null = null

function optionsKey(year: number, options: RomcalOptions): string {
  return `${year}_${options.epiphanyOnSunday}_${options.corpusChristiOnSunday}_${options.ascensionOnSunday}`
}

function getRomcalInstance(options: RomcalOptions): Romcal {
  const changed =
    !romcalInstanceOptions ||
    romcalInstanceOptions.epiphanyOnSunday !== options.epiphanyOnSunday ||
    romcalInstanceOptions.corpusChristiOnSunday !==
      options.corpusChristiOnSunday ||
    romcalInstanceOptions.ascensionOnSunday !== options.ascensionOnSunday

  if (!romcalInstance || changed) {
    romcalInstance = new Romcal({
      localizedCalendar: Vietnam_En,
      epiphanyOnSunday: options.epiphanyOnSunday,
      corpusChristiOnSunday: options.corpusChristiOnSunday,
      ascensionOnSunday: options.ascensionOnSunday,
    })
    romcalInstanceOptions = options
  }
  return romcalInstance
}

function readFromStorage(key: string): LiturgicalDayMap | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return raw ? (JSON.parse(raw) as LiturgicalDayMap) : null
  } catch {
    return null
  }
}

function writeToStorage(key: string, data: LiturgicalDayMap) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data))
  } catch {
    // storage full or unavailable — in-memory cache still applies this session
  }
}

export async function getLiturgicalDayMap(
  year: number,
  options: RomcalOptions = DEFAULT_OPTIONS,
): Promise<LiturgicalDayMap> {
  const key = optionsKey(year, options)

  const cached = memoryCache.get(key)
  if (cached) return cached

  const stored = readFromStorage(key)
  if (stored) {
    memoryCache.set(key, stored)
    return stored
  }

  const calendar = await getRomcalInstance(options).generateCalendar(year)
  const map: LiturgicalDayMap = {}
  for (const [date, days] of Object.entries(calendar)) {
    if (days.length > 0) {
      map[date] = {
        name: days[0].name,
        colorName: days[0].colorNames[0] ?? null,
      }
    }
  }

  memoryCache.set(key, map)
  writeToStorage(key, map)
  return map
}

// isoDate must be `YYYY-MM-DD`. Returns null if outside a computable range.
export async function getLiturgicalDateLabel(
  isoDate: string,
  options: RomcalOptions = DEFAULT_OPTIONS,
): Promise<string | null> {
  const year = Number(isoDate.slice(0, 4))
  if (!Number.isFinite(year)) return null
  const map = await getLiturgicalDayMap(year, options)
  return map[isoDate]?.name ?? null
}

// isoDate must be `YYYY-MM-DD`. Returns null if outside a computable range.
export async function getLiturgicalDayInfo(
  isoDate: string,
  options: RomcalOptions = DEFAULT_OPTIONS,
): Promise<LiturgicalDayInfo | null> {
  const year = Number(isoDate.slice(0, 4))
  if (!Number.isFinite(year)) return null
  const map = await getLiturgicalDayMap(year, options)
  return map[isoDate] ?? null
}
