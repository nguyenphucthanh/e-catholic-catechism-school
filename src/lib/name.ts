export function formatPersonName(
  saintName: string | null | undefined,
  fullName: string,
): string {
  return saintName ? `${saintName} ${fullName}` : fullName
}

export type NameFormat = 'firstName_lastName' | 'lastName_firstName'

// firstName_lastName: compare whole fullName; otherwise compare the last word
// (Vietnamese given name). Returns a new array.
export function sortByNameFormat<T>(
  items: ReadonlyArray<T>,
  getFullName: (item: NoInfer<T>) => string,
  nameFormat: NameFormat | undefined,
): Array<T> {
  const key = (item: T) => {
    const name = getFullName(item).toLocaleLowerCase()
    return nameFormat === 'firstName_lastName'
      ? name
      : (name.split(' ').pop() ?? '')
  }
  return [...items].sort((a, b) => key(a).localeCompare(key(b), 'vi'))
}
