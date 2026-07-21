import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Pencil, Printer, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import { StudentDetailCards } from '~/components/custom/student-detail-cards'
import { formatPersonName } from '~/lib/name'
import { ProfileAvatar } from '~/components/custom/profile-avatar'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/$id',
)({
  component: StudentDetailPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'common.detail' },
    ],
  },
})

function StudentDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const canManage = isAdmin(user)

  const data = useQuery(
    api.students.getStudentDetail,
    requesterId ? { requesterId, studentId: id as Id<'students'> } : 'skip',
  )

  const appConfig = useQuery(api.appConfig.get)

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
    if (!data || !appConfig) return
    exportQrCardsPdf(
      [
        {
          studentCode: data.studentCode,
          fullName: data.fullName,
          saintName: data.saintName,
        },
      ],
      {
        troopName: appConfig.troopName,
        parishName: appConfig.parishName,
        studentCodeLabel: t('printCards.studentCodeLabel'),
      },
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
          <Button render={<Link to="/students" />} variant="outline">
            {t('common.back')}
          </Button>
        </div>
      </div>
    )
  }

  const actions = (
    <>
      <Button onClick={handlePrintCard} variant="outline">
        <Printer className="mr-2 size-4" />
        {t('printCards.singleAction')}
      </Button>
      <Button
        render={<Link to="/students/$id/attendance" params={{ id: id! }} />}
        variant="outline"
      >
        <CalendarCheck className="mr-2 size-4" />
        {t('students.attendance.title')}
      </Button>
      {canManage && (
        <Button
          render={<Link to="/students/$id/edit" params={{ id: id! }} />}
          variant="outline"
        >
          <Pencil className="mr-2 size-4" />
          {t('common.edit')}
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
              <Label className="flex items-center gap-2 justify-end w-full">
                <span className="text-sm text-muted-foreground">
                  {t('students.detail.showQrCode')}
                </span>
                <Switch checked={showQrCode} onCheckedChange={setShowQrCode} />
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      <StudentDetailCards
        data={data}
        requester={
          requesterId ? { accountType: 'catechist', requesterId } : undefined
        }
      />
    </div>
  )
}
