import {
  Navigate,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Layers } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { isAdmin } from '~/lib/permissions'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { OrgStatsWidget } from '~/components/custom/org-stats-widget'
import { BranchStatsWidget } from '~/components/custom/branch-stats-widget'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/academic-years_/$id',
)({
  component: AcademicYearDetailPage,
  staticData: {
    crumbs: [
      { label: 'academicYears.title', path: '/academic-years' },
      { label: 'academicYears.detail.title' },
    ],
  },
})

function AcademicYearDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const academicYearId = id as Id<'academicYears'>

  const year = useQuery(
    api.academicYears.get,
    requesterId ? { requesterId, id: academicYearId } : 'skip',
  )
  const semesters = useQuery(
    api.academicYears.listSemesters,
    requesterId ? { requesterId, academicYearId } : 'skip',
  )
  const setActiveMutation = useMutation(api.academicYears.setActive)
  const deleteMutation = useMutation(api.academicYears.softDelete)

  const [confirmDelete, setConfirmDelete] = React.useState(false)

  if (year === null) {
    return <Navigate to="/academic-years" />
  }

  const handleSetActive = async () => {
    if (!requesterId) return
    try {
      await setActiveMutation({ requesterId, academicYearId })
      toast.success(t('academicYears.setActiveSuccess'))
    } catch {
      toast.error(t('academicYears.saveError'))
    }
  }

  const handleDelete = async () => {
    if (!requesterId) return
    try {
      await deleteMutation({ requesterId, academicYearId })
      toast.success(t('academicYears.deleted'))
      setConfirmDelete(false)
      navigate({ to: '/academic-years' })
    } catch (err) {
      toast.error(translateConvexError(err, t, 'academicYears.deleteError'))
    }
  }

  const subtitle = year
    ? `${formatDate(year.startDate)} – ${formatDate(year.endDate)} · ${year.timezone}`
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarDays}
        title={year?.name ?? t('academicYears.detail.title')}
        subtitle={
          <div className={'inline-flex gap-1 flex-wrap'}>
            {year && (
              <Badge variant={year.isActive ? 'default' : 'secondary'}>
                {year.isActive
                  ? t('academicYears.status.active')
                  : t('academicYears.status.inactive')}
              </Badge>
            )}
            {subtitle}
          </div>
        }
        actions={
          year && (
            <div className="flex items-center gap-2">
              {canManage && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={year.isActive}
                    onClick={handleSetActive}
                  >
                    {t('academicYears.actions.setActive')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: '/academic-years/$id/edit',
                        params: { id: academicYearId },
                      })
                    }
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t('common.delete')}
                  </Button>
                </>
              )}
            </div>
          )
        }
      />

      {academicYearId && requesterId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <OrgStatsWidget
            requesterId={requesterId}
            academicYearId={academicYearId}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="size-5 text-muted-foreground" />
                {t('academicYears.form.semesters')}
              </CardTitle>
              <CardDescription>
                {t('academicYears.form.semesters.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {semesters === undefined ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {semesters.map((s) => (
                    <Badge key={s._id} variant="outline">
                      {t('semesters.numberLabel', { number: s.semesterNumber })}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {academicYearId && requesterId && (
        <BranchStatsWidget
          requesterId={requesterId}
          academicYearId={academicYearId}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('academicYears.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('academicYears.delete.description', {
                name: year?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('academicYears.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
