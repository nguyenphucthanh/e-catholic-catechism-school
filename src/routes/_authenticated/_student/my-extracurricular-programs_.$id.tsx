import { createFileRoute, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Tent } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import type { Id } from '~/../convex/_generated/dataModel'
import { api } from '~/../convex/_generated/api'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { formatDate } from '~/lib/locale'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { RichTextEditor } from '~/components/custom/richtext-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export const Route = createFileRoute(
  '/_authenticated/_student/my-extracurricular-programs_/$id',
)({
  component: MyExtracurricularProgramDetailPage,
  staticData: {
    crumbs: [
      {
        label: 'extracurricular.title',
        path: '/my-extracurricular-programs',
      },
      { label: 'common.view' },
    ],
  },
})

function MyExtracurricularProgramDetailPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { id } = useParams({
    from: '/_authenticated/_student/my-extracurricular-programs_/$id',
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showFeeDialog, setShowFeeDialog] = React.useState(false)

  const studentRequesterId = user?.userDocId as Id<'students'> | undefined

  const program = useQuery(
    api.extracurricularPrograms.getProgramDetail,
    studentRequesterId
      ? {
          programId: id as Id<'extracurricularPrograms'>,
          studentRequesterId,
        }
      : 'skip',
  )

  const enrollProgram = useMutation(api.extracurricularPrograms.enrollProgram)

  const handleEnroll = async () => {
    if (!studentRequesterId) return
    setIsSubmitting(true)
    try {
      await enrollProgram({
        programId: id as Id<'extracurricularPrograms'>,
        studentRequesterId,
      })
      toast.success(t('extracurricular.enrolledSuccess'))
      if (program?.feeRequired) {
        setShowFeeDialog(true)
      }
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
        <PageHeader icon={Tent} title={program.title} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('common.information')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow">
              <div>
                <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    {t('extracurricular.dateStart')}
                  </p>
                  <p>{formatDate(program.dateStart)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('extracurricular.dateEnd')}
                  </p>
                  <p>{formatDate(program.dateEnd)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
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
              {program.feeRequired && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('extracurricular.fee')}
                  </p>
                  <p className="text-lg font-semibold">
                    {program.feeAmount || 0}
                  </p>
                </div>
              )}

              <div className="pt-2">
                {program.userEnrolled ? null : today >
                  program.enrollmentExpireDate ? (
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
      </div>

      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('extracurricular.feeDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('extracurricular.feeDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowFeeDialog(false)}>
              {t('common.gotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
