import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { hasManagementPermission, isCatechist } from '~/lib/permissions'

export function useManagementPermission() {
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()

  const permissions = useQuery(
    api.catechistPermissions.getPermissions,
    user && isCatechist(user) && selectedYearId
      ? { academicYearId: selectedYearId }
      : 'skip',
  )

  const canManage = hasManagementPermission(user, permissions)
  const isLoading =
    user && isCatechist(user) && selectedYearId
      ? permissions === undefined
      : false

  return { canManage, isLoading, permissions }
}
