export const HARDCODED_CATECHIST_TITLES = [
  { value: 'Giáo Lý Viên', labelKey: 'profile.personal.title.catechist' },
  { value: 'Cha', labelKey: 'profile.personal.title.cha' },
  { value: 'Thầy', labelKey: 'profile.personal.title.thay' },
  { value: 'Soeur', labelKey: 'profile.personal.title.soeur' },
  { value: 'Huynh Trưởng', labelKey: 'profile.personal.title.huynh_truong' },
] as const

export type HardcodedCatechistTitle =
  (typeof HARDCODED_CATECHIST_TITLES)[number]['value']

type Translate = (key: string) => string
type Option = { value: string; label: string }

function titleOptions(t: Translate, customTitles: Array<string> = []) {
  const seen = new Set(
    HARDCODED_CATECHIST_TITLES.map((h) => h.value.toLowerCase()),
  )
  const custom: Array<Option> = []
  for (const raw of customTitles) {
    const title = raw.trim()
    if (!title || seen.has(title.toLowerCase())) continue
    seen.add(title.toLowerCase())
    custom.push({ value: title, label: title })
  }
  return [
    ...HARDCODED_CATECHIST_TITLES.map((h) => ({
      value: h.value,
      label: t(h.labelKey),
    })),
    ...custom,
  ]
}

export function buildCatechistTitleOptions(
  t: Translate,
  customTitles?: Array<string>,
): Array<Option> {
  return [
    { value: '', label: t('profile.personal.title.none') },
    ...titleOptions(t, customTitles),
  ]
}

export function buildCatechistFilterTitleOptions(
  t: Translate,
  customTitles?: Array<string>,
): Array<Option> {
  return [
    { value: '', label: t('catechists.filters.anyTitle') },
    { value: 'none', label: t('profile.personal.title.none') },
    ...titleOptions(t, customTitles),
  ]
}
