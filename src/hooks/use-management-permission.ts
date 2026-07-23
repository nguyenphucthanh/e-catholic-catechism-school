import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { hasManagementPermission, isCatechist } from '~/lib/permissions'

export function useManagementPermission() {
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()

  const requesterId =
    user && isCatechist(user) ? (user.userDocId as Id<'catechists'>) : undefined

  const permissions = useQuery(
    api.catechistPermissions.getPermissions,
    requesterId && selectedYearId
      ? { requesterId, academicYearId: selectedYearId }
      : 'skip',
  )

  const canManage = hasManagementPermission(user, permissions)
  const isLoading =
    user && isCatechist(user) && selectedYearId
      ? permissions === undefined
      : false

  return { canManage, isLoading, permissions }
}
