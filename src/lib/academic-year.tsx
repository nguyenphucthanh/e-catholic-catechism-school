import * as React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
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

  const activeYear = useQuery(api.academicYears.getActive)
  // All non-deleted years, used to detect a persisted selection that no
  // longer exists (e.g. the year was soft-deleted after being selected).
  const allYears = useQuery(api.academicYears.list)

  React.useEffect(() => {
    if (activeYear === undefined || allYears === undefined) return

    const selectionIsValid =
      selectedYearId !== null && allYears.some((y) => y._id === selectedYearId)

    if (!selectionIsValid && activeYear) {
      setSelectedYearIdState(activeYear._id)
      localStorage.setItem(YEAR_KEY, activeYear._id)
    }
  }, [selectedYearId, activeYear, allYears])

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
