export function formatPersonName(
  saintName: string | null | undefined,
  fullName: string,
): string {
  return saintName ? `${saintName} ${fullName}` : fullName
}

export type NameFormat = 'firstName_lastName' | 'lastName_firstName'

// firstName_lastName: compare whole fullName; otherwise compare the last word
// (Vietnamese given name).
export function compareByNameFormat(
  a: string,
  b: string,
  nameFormat: NameFormat | undefined,
): number {
  const key = (fullName: string) => {
    const name = fullName.toLocaleLowerCase()
    return nameFormat === 'firstName_lastName'
      ? name
      : (name.split(' ').pop() ?? '')
  }
  return key(a).localeCompare(key(b), 'vi')
}

// Vietnamese alphabet in collation order. Convex indexes compare strings by
// code point, which would put Ă/Â/Đ after Z, so each letter is remapped to an
// ASCII-range char that keeps this order.
const COLLATION_ALPHABET = 'aăâbcdđeêfghijklmnoôơpqrstuưvwxyz'
const COLLATION_RANK = new Map(
  [...COLLATION_ALPHABET].map((ch, i) => [ch, String.fromCharCode(0x61 + i)]),
)
// Tone marks: grave, acute, tilde, hook above, dot below. Treated as ties
// (breve, circumflex and horn are part of the letter, so they are kept).
const TONE_MARKS = /[̣̀́̃̉]/g

function collationKey(text: string): string {
  return [
    ...text
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(TONE_MARKS, '')
      .normalize('NFC'),
  ]
    .map((ch) => COLLATION_RANK.get(ch) ?? ch)
    .join('')
}

// Index-sortable key mirroring compareByNameFormat: the whole name for
// firstName_lastName, else the last word (given name) then the whole name as
// tie-break. Stored on students.nameSortKey; must be recomputed whenever
// fullName or appConfig.nameFormat changes.
export function nameSortKey(
  fullName: string,
  nameFormat: NameFormat | undefined,
): string {
  const whole = collationKey(fullName.trim())
  if (nameFormat === 'firstName_lastName') return whole
  const lastWord = whole.split(' ').pop() ?? ''
  return `${lastWord} ${whole}`
}
