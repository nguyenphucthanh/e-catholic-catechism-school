import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../../../convex/_generated/api'
import { ProfileAvatar } from './profile-avatar'
import type { Id } from '../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { EnrollmentSummary } from '~/components/custom/enrollment-summary'
import { formatPersonName } from '~/lib/name'

export function StudentDashboard({ studentId }: { studentId: Id<'students'> }) {
  const { t } = useTranslation()
  const data = useQuery(api.students.getMyProfile, { requesterId: studentId })

  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!showQrCode || !data) {
      setQrCodeUrl(null)
      return
    }
    QRCode.toDataURL(data.studentCode).then(setQrCodeUrl)
  }, [showQrCode, data])

  if (data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            {t('students.detail.enrollments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full mb-3" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const latestEnrollment = data.enrollments
    .slice()
    .sort((a, b) => b.enrolledDate.localeCompare(a.enrolledDate))
    .at(0)

  return (
    <>
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
                  userType={'student'}
                  userId={data._id}
                  fullName={data.fullName}
                  className={'size-32!'}
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
      {!latestEnrollment ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-muted-foreground" />
              {t('students.detail.enrollments.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('students.enrollments.noRecord')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-muted-foreground" />
              {latestEnrollment.classYear.className}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {latestEnrollment.classYear.academicYearName}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <EnrollmentSummary
              studentClassId={latestEnrollment._id}
              requester={{ accountType: 'student', requesterId: studentId }}
            />
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              {t('students.dashboard.viewAllHistoryPrefix')}{' '}
              <Link
                to="/profile"
                className="text-primary underline underline-offset-4"
              >
                {t('students.dashboard.viewAllHistoryLink')}
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
