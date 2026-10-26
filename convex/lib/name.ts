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
