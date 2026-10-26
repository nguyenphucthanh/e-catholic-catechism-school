import { compareByNameFormat } from '../../convex/lib/name'
import type { NameFormat } from '../../convex/lib/name'

export function formatPersonName(
  saintName: string | null | undefined,
  fullName: string,
): string {
  return saintName ? `${saintName} ${fullName}` : fullName
}

export type { NameFormat }
export { compareByNameFormat }

// Returns a new array sorted by compareByNameFormat.
export function sortByNameFormat<T>(
  items: ReadonlyArray<T>,
  getFullName: (item: NoInfer<T>) => string,
  nameFormat: NameFormat | undefined,
): Array<T> {
  return [...items].sort((a, b) =>
    compareByNameFormat(getFullName(a), getFullName(b), nameFormat),
  )
}
