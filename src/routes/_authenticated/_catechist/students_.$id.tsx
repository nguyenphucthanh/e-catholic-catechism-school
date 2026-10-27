import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Pencil, Printer, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { translateConvexError } from '~/lib/convex-errors'
import { PageHeader } from '~/components/page-header'
import { Card, CardContent, CardFooter } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
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
import { StudentDetailCards } from '~/components/custom/student-detail-cards'
import { formatPersonName } from '~/lib/name'
import { ProfileAvatar } from '~/components/custom/profile-avatar'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'
import { useQrCardConfig } from '~/hooks/use-qr-card-config'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/$id',
)({
  component: StudentDetailPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.detail.title' },
    ],
  },
})

function StudentDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const photoUrl = useQuery(api.students.getProfilePhotoUrl, {
    studentId: id as Id<'students'>,
  })

  const { user } = useAuth()
  const navigate = useNavigate()

  const data = useQuery(api.students.getStudentDetail, {
    studentId: id as Id<'students'>,
  })

  const canManage = data?.isEditable ?? false
  const canDelete = isAdmin(user)

  const qrCardConfig = useQrCardConfig()

  const deleteMutation = useMutation(api.students.softDelete)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    if (!data) return
    try {
      await deleteMutation({ studentId: data._id })
      toast.success(t('students.deleted'))
      navigate({ to: '/students' })
    } catch (err) {
      toast.error(translateConvexError(err, t, 'students.deleteError'))
    } finally {
      setConfirmDelete(false)
    }
  }

  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!showQrCode || !data) {
      setQrCodeUrl(null)
      return
    }
    QRCode.toDataURL(data.studentCode).then(setQrCodeUrl)
  }, [showQrCode, data])

  const handlePrintCard = () => {
    if (!data || !qrCardConfig) return
    exportQrCardsPdf(
      [
        {
          studentCode: data.studentCode,
          fullName: data.fullName,
          saintName: data.saintName,
          photoUrl: photoUrl ?? undefined,
        },
      ],
      qrCardConfig,
      `${data.studentCode}-card.pdf`,
    )
  }

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={Users} title={t('students.detail.title')} />
        <div className="bg-card border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {t('students.notFound')}
          </p>
          <Button
            nativeButton={false}
            render={<Link to="/students" />}
            variant="outline"
          >
            {t('common.back')}
          </Button>
        </div>
      </div>
    )
  }

  const actions = (
    <>
      <Button
        nativeButton={false}
        render={<Link to="/students/$id/attendance" params={{ id: id! }} />}
        variant="outline"
      >
        <CalendarCheck className="mr-2 size-4" />
        {t('students.attendance.title')}
      </Button>
      {canManage && (
        <Button
          nativeButton={false}
          render={<Link to="/students/$id/edit" params={{ id: id! }} />}
          variant="outline"
        >
          <Pencil className="mr-2 size-4" />
          {t('common.edit')}
        </Button>
      )}
      {canDelete && (
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-2 size-4" />
          {t('common.delete')}
        </Button>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={
          data
            ? formatPersonName(data.saintName, data.fullName)
            : t('students.detail.title')
        }
        actions={actions}
      />

      {data && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                {showQrCode && qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt={data.studentCode}
                    className="size-32"
                  />
                ) : (
                  <ProfileAvatar
                    size="lg"
                    className={'size-32!'}
                    userType={'student'}
                    userId={data._id}
                    fullName={data.fullName}
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold">
                    {formatPersonName(data.saintName, data.fullName)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('students.col.studentCode')}: {data.studentCode}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-4">
            <Button onClick={handlePrintCard} variant="outline">
              <Printer className="mr-2 size-4" />
              {t('printCards.singleAction')}
            </Button>
            <Label className="flex items-center gap-2 justify-end">
              <span className="text-sm text-muted-foreground">
                {t('students.detail.showQrCode')}
              </span>
              <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
            </Label>
          </CardFooter>
        </Card>
      )}

      <StudentDetailCards data={data} />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('students.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('students.delete.description', {
                name: data
                  ? formatPersonName(data.saintName, data.fullName)
                  : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('students.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
