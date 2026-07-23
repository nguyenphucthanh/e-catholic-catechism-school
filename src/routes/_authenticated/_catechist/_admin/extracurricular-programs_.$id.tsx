import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronLeft, Edit, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { formatDate } from '~/lib/locale'
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

export const Route = createFileRoute(
  '/_authenticated/_catechist/_admin/extracurricular-programs_/$id',
)({
  component: ExtracurricularProgramDetailPage,
  staticData: {
    crumbs: [
      { label: 'nav.admin' },
      { label: 'extracurricular.title' },
      { label: 'common.view' },
    ],
  },
})

function ExtracurricularProgramDetailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams({
    from: '/_authenticated/_catechist/_admin/extracurricular-programs_/$id',
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

  const enrollments = useQuery(
    api.extracurricularPrograms.getEnrollments,
    requesterId
      ? {
          programId: id as Id<'extracurricularPrograms'>,
          requesterId,
        }
      : 'skip',
  )

  const deleteProgram = useMutation(api.extracurricularPrograms.deleteProgram)

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
        <div className="flex items-center gap-2">
          <Link to="/extracurricular-programs">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
          </Link>
        </div>

        <PageHeader
          icon={BookOpen}
          title={program.title}
          actions={
            <div className="flex gap-2">
              <Link to="/extracurricular-programs/$id/edit" params={{ id: id }}>
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
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('common.information')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
              <div>
                <p className="text-sm text-gray-600">
                  {t('extracurricular.enrollmentExpireDate')}
                </p>
                <p>{formatDate(program.enrollmentExpireDate)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('common.enrollment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
                    {program.feeAmount || 0}
                  </p>
                </div>
              )}
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
            />
          </CardContent>
        </Card>

        {enrollments && enrollments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('extracurricular.enrollments')}</CardTitle>
              <CardDescription>
                {t('extracurricular.enrollmentCount', {
                  count: enrollments.length,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {enrollments.map((e) => (
                  <div key={e._id} className="text-sm">
                    {e.tokenIdentifier}
                  </div>
                ))}
              </div>
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
