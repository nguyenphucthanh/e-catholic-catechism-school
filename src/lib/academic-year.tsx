import * as React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from './auth'
import type { Id } from '../../convex/_generated/dataModel'

const YEAR_KEY = 'giaoly_selected_year'

type AcademicYearContextValue = {
  selectedYearId: Id<'academicYears'> | null
  setSelectedYearId: (id: Id<'academicYears'> | null) => void
}

const AcademicYearContext =
  React.createContext<AcademicYearContextValue | null>(null)

export function AcademicYearProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const requesterId =
    user?.accountType === 'catechist'
      ? (user.userDocId as Id<'catechists'>)
      : undefined
  const [selectedYearId, setSelectedYearIdState] =
    React.useState<Id<'academicYears'> | null>(() => {
      if (typeof window === 'undefined') return null
      try {
        const stored = localStorage.getItem(YEAR_KEY)
        return stored ? (stored as Id<'academicYears'>) : null
      } catch {
        return null
      }
    })

  // Active year + every non-deleted year (used to detect a persisted
  // selection that no longer exists, e.g. soft-deleted after being selected).
  const yearContext = useQuery(
    api.academicYears.getActiveYearContext,
    requesterId ? {} : 'skip',
  )

  React.useEffect(() => {
    if (yearContext === undefined) return
    const { activeYear, recentYears: allYears } = yearContext

    const selectionIsValid =
      selectedYearId !== null && allYears.some((y) => y._id === selectedYearId)

    if (!selectionIsValid && activeYear) {
      setSelectedYearIdState(activeYear._id)
      localStorage.setItem(YEAR_KEY, activeYear._id)
    }
  }, [selectedYearId, yearContext])

  const setSelectedYearId = React.useCallback(
    (id: Id<'academicYears'> | null) => {
      setSelectedYearIdState(id)
      if (id) {
        localStorage.setItem(YEAR_KEY, id)
      } else {
        localStorage.removeItem(YEAR_KEY)
      }
    },
    [],
  )

  return (
    <AcademicYearContext.Provider value={{ selectedYearId, setSelectedYearId }}>
      {children}
    </AcademicYearContext.Provider>
  )
}

export function useSelectedAcademicYear() {
  const ctx = React.useContext(AcademicYearContext)
  if (!ctx) {
    throw new Error(
      'useSelectedAcademicYear must be used within AcademicYearProvider',
    )
  }
  return ctx
}

export function useInactiveYear() {
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()

  // Also used outside /_authenticated (photobooth), where a stale persisted
  // year can exist without a catechist session; academicYears.get is
  // catechist-only and would throw.
  const selectedYear = useQuery(
    api.academicYears.get,
    user?.accountType === 'catechist' && selectedYearId
      ? { id: selectedYearId }
      : 'skip',
  )

  return {
    isInactive: selectedYear ? !selectedYear.isActive : false,
    yearName: selectedYear?.name ?? null,
  }
}
