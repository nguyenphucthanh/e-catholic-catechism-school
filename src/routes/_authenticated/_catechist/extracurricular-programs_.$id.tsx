import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Edit, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { ColumnDef } from '@tanstack/react-table'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { formatCurrency, formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { RichTextEditor } from '~/components/custom/richtext-editor'
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
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { DataTable } from '~/components/custom/data-table'
import { formatPersonName } from '~/lib/name'
import { useManagementPermission } from '~/hooks/use-management-permission'

export const Route = createFileRoute(
  '/_authenticated/_catechist/extracurricular-programs_/$id',
)({
  component: ExtracurricularProgramDetailPage,
  staticData: {
    crumbs: [
      { label: 'extracurricular.title', path: '/extracurricular-programs' },
      { label: 'common.view' },
    ],
  },
})

interface EnrollmentRow {
  _id: Id<'extracurricularEnrollments'>
  userType: string
  createdAt: number
  participantName: string
  saintName?: string
  fullName?: string
  code?: string
  className?: string
  tokenIdentifier: string
}

function ExtracurricularProgramDetailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { canManage, isLoading } = useManagementPermission()
  const { id } = useParams({
    from: '/_authenticated/_catechist/extracurricular-programs_/$id',
  })
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const program = useQuery(
    api.extracurricularPrograms.getProgramDetail,
    requesterId
      ? {
          programId: id as Id<'extracurricularPrograms'>,
          requesterId,
        }
      : 'skip',
  )

  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const enrollments = useQuery(
    api.extracurricularPrograms.getEnrollments,
    requesterId && canManage
      ? {
          programId: id as Id<'extracurricularPrograms'>,
          requesterId,
        }
      : 'skip',
  )

  const deleteProgram = useMutation(api.extracurricularPrograms.deleteProgram)
  const enrollProgram = useMutation(api.extracurricularPrograms.enrollProgram)
  const unenrollProgram = useMutation(
    api.extracurricularPrograms.unenrollProgram,
  )

  const columns = React.useMemo<Array<ColumnDef<EnrollmentRow>>>(
    () => [
      {
        accessorKey: 'participantName',
        header: () => t('extracurricular.participant'),
        cell: ({ row }) => {
          const e = row.original
          const initial = (e.fullName || e.tokenIdentifier || 'U')
            .charAt(0)
            .toUpperCase()

          return (
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="text-xs font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-foreground">
                  {e.participantName}
                </div>
                {e.code && (
                  <div className="text-xs text-muted-foreground">{e.code}</div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'userType',
        header: () => t('extracurricular.userType'),
        cell: ({ row }) => {
          const userType = row.original.userType
          return (
            <Badge
              variant={
                userType === 'catechist'
                  ? 'default'
                  : userType === 'student'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {t(`extracurricular.type.${userType}`)}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'className',
        header: () => t('extracurricular.class'),
        cell: ({ row }) => {
          const className = row.original.className
          return className ? (
            <Badge variant="outline">{className}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
        },
      },
      {
        accessorKey: 'createdAt',
        header: () => t('extracurricular.enrolledAt'),
        cell: ({ row }) => {
          const createdAt = row.original.createdAt
          return (
            <span className="text-sm text-muted-foreground">
              {formatDate(new Date(createdAt).toISOString().split('T')[0])}
            </span>
          )
        },
      },
    ],
    [t],
  )

  const enrollmentRows = React.useMemo<Array<EnrollmentRow>>(() => {
    if (!enrollments) return []
    return enrollments.map((e) => ({
      _id: e._id,
      userType: e.userType,
      createdAt: e.createdAt,
      participantName: formatPersonName(
        e.userInfo.saintName,
        e.userInfo.fullName || e.tokenIdentifier,
      ),
      saintName: e.userInfo.saintName,
      fullName: e.userInfo.fullName,
      code: e.userInfo.code,
      className: e.userInfo.className,
      tokenIdentifier: e.tokenIdentifier,
    }))
  }, [enrollments])

  if (isLoading) return null

  const handleDelete = async () => {
    if (!requesterId) return
    try {
      await deleteProgram({
        programId: id as Id<'extracurricularPrograms'>,
        requesterId,
      })
      toast.success(t('common.deleted'))
      // Navigate back to list
      window.location.href = '/extracurricular-programs'
    } catch (error) {
      toast.error(translateConvexError(error, t))
    }
  }

  const handleEnroll = async () => {
    if (!requesterId) return
    setIsSubmitting(true)
    try {
      await enrollProgram({
        programId: id as Id<'extracurricularPrograms'>,
        requesterId,
      })
      toast.success(t('extracurricular.enrolledSuccess'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnenroll = async () => {
    if (!requesterId) return
    setIsSubmitting(true)
    try {
      await unenrollProgram({
        programId: id as Id<'extracurricularPrograms'>,
        requesterId,
      })
      toast.success(t('extracurricular.unenrolledSuccess'))
    } catch (error) {
      toast.error(translateConvexError(error, t))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!program) {
    return <div>{t('common.loading')}</div>
  }

  const today = new Date().toISOString().split('T')[0]
  const status =
    program.dateStart > today
      ? 'upcoming'
      : program.dateEnd < today
        ? 'past'
        : 'active'

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          icon={BookOpen}
          title={program.title}
          actions={
            canManage ? (
              <div className="flex gap-2">
                <Link
                  to="/extracurricular-programs/$id/edit"
                  params={{ id: id }}
                >
                  <Button size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </div>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('common.information')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow">
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.target')}
                </p>
                <Badge variant="secondary">
                  {t(`extracurricular.target.${program.target}`)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.status')}
                </p>
                <Badge
                  variant={
                    status === 'active'
                      ? 'default'
                      : status === 'upcoming'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {t(`extracurricular.status.${status}`)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {t('extracurricular.dateStart')}
                  </p>
                  <p>{formatDate(program.dateStart)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {t('extracurricular.dateEnd')}
                  </p>
                  <p>{formatDate(program.dateEnd)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.enrollmentExpireDate')}
                </p>
                <p>{formatDate(program.enrollmentExpireDate)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                {t('common.enrollment')}
                {program.userEnrolled && (
                  <Badge>{t('extracurricular.enrolled')}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 grow">
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.enrollment')}
                </p>
                <p className="text-2xl font-bold">
                  {program.enrollmentCount}
                  {program.maxCapacity ? `/${program.maxCapacity}` : ''}
                </p>
              </div>
              {program.feeRequired && (
                <div>
                  <p className="text-sm text-gray-600">
                    {t('extracurricular.fee')}
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(program.feeAmount || 0)}
                  </p>
                </div>
              )}

              <div className="pt-2">
                {program.userEnrolled ? (
                  <Button
                    variant="outline"
                    onClick={handleUnenroll}
                    disabled={isSubmitting}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    {t('extracurricular.unenroll')}
                  </Button>
                ) : program.target === 'student' ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t('extracurricular.studentOnlyTarget')}
                    </AlertDescription>
                  </Alert>
                ) : today > program.enrollmentExpireDate ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.enrollmentClosed')}
                  </Button>
                ) : program.maxCapacity &&
                  program.enrollmentCount >= program.maxCapacity ? (
                  <Button disabled variant="outline" className="w-full">
                    {t('extracurricular.capacityReached')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleEnroll}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {t('extracurricular.enroll')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('extracurricular.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={program.details}
              onChange={() => {}}
              editable={false}
              mode="advance"
            />
          </CardContent>
        </Card>

        {canManage && enrollments && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>{t('extracurricular.enrollments')}</CardTitle>
                <CardDescription>
                  {t('extracurricular.enrollmentCount', {
                    count: enrollments.length,
                  })}
                </CardDescription>
              </div>
              <Badge variant="outline">{enrollments.length}</Badge>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={enrollmentRows}
                searchPlaceholder={t('common.search')}
                searchColumnKey="participantName"
                emptyText={t('extracurricular.noEnrollments')}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('extracurricular.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
