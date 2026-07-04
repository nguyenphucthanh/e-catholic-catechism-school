import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import {
  Award,
  Calendar,
  ChevronDown,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
} from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { PageHeader } from '~/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { EnrollmentSummary } from '~/components/custom/enrollment-summary'
import { formatDate } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'

export const Route = createFileRoute('/_authenticated/_catechist/students_/$id')({
  component: StudentDetailPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.detail.title' },
    ],
  },
})

const SACRAMENT_TYPES = [
  'baptism',
  'first_confession',
  'first_communion',
  'confirmation',
] as const

function StudentDetailPage() {
  const { id } = useParams({ strict: false })
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const canManage = isAdmin(user)

  const data = useQuery(
    api.students.getStudentDetail,
    requesterId ? { requesterId, studentId: id as Id<'students'> } : 'skip',
  )

  if (data === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={Users} title={t('students.detail.title')} />
        <div className="bg-card border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {t('students.notFound')}
          </p>
          <Button
            onClick={() => navigate({ to: '/students' })}
            variant="outline"
          >
            {t('common.back')}
          </Button>
        </div>
      </div>
    )
  }

  const actions = canManage ? (
    <Button
      onClick={() =>
        navigate({ to: '/students/$id/edit', params: { id: id! } })
      }
      variant="outline"
    >
      <Pencil className="mr-2 size-4" />
      {t('common.edit')}
    </Button>
  ) : undefined

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

      {/* Personal Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('students.detail.personal.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.col.studentCode')}
                  </p>
                  <p className="font-mono">{data.studentCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.col.fullName')}
                  </p>
                  <p>{formatPersonName(data.saintName, data.fullName)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('profile.personal.dob')}
                  </p>
                  <p>{data.dateOfBirth ? formatDate(data.dateOfBirth) : '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.col.gender')}
                  </p>
                  <p>
                    {data.gender ? (
                      <Badge variant="secondary">
                        {t(`students.gender.${data.gender}`)}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.col.status')}
                  </p>
                  <p>
                    <Badge variant={data.isActive ? 'default' : 'secondary'}>
                      {data.isActive
                        ? t('students.status.active')
                        : t('students.status.inactive')}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.detail.previousParish')}
                  </p>
                  <p>{data.previousParish || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('students.detail.previousDiocese')}
                  </p>
                  <p>{data.previousDiocese || '-'}</p>
                </div>
              </div>

              {/* Address section */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  {t('profile.address.title')}
                </h3>
                {!data.address ? (
                  <p className="text-sm text-muted-foreground">-</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.line1')}
                      </p>
                      <p>{data.address.addressLine1 || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.line2')}
                      </p>
                      <p>{data.address.addressLine2 || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.city')}
                      </p>
                      <p>{data.address.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.postal')}
                      </p>
                      <p>{data.address.postalCode || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.hamlet')}
                      </p>
                      <p>{data.address.hamlet || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.subHamlet')}
                      </p>
                      <p>{data.address.subHamlet || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('profile.address.country')}
                      </p>
                      <p>{data.address.country || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sacraments Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-5 text-muted-foreground" />
            {t('students.detail.sacraments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data.sacraments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.sacraments.noRecord')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 font-semibold text-muted-foreground">
                      {t('students.detail.sacraments.type')}
                    </th>
                    <th className="pb-2 font-semibold text-muted-foreground">
                      {t('students.detail.sacraments.receivedDate')}
                    </th>
                    <th className="pb-2 font-semibold text-muted-foreground">
                      {t('students.detail.sacraments.receivedPlace')}
                    </th>
                    <th className="pb-2 font-semibold text-muted-foreground">
                      {t('students.detail.sacraments.notes')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SACRAMENT_TYPES.map((type) => {
                    const record = data.sacraments.find(
                      (s) => s.sacramentType === type,
                    )
                    return (
                      <tr
                        key={type}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <Badge variant={record ? 'default' : 'outline'}>
                            {t(`students.sacraments.${type}`)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          {record?.receivedDate
                            ? formatDate(record.receivedDate)
                            : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          {record?.receivedPlace || '—'}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {record?.notes || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guardians Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-muted-foreground" />
            {t('students.detail.guardians.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data.guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.detail.guardians.noRecord')}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.guardians.map((g) => (
                <div
                  key={g._id}
                  className="border rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-base">
                        {formatPersonName(
                          g.guardian.saintName,
                          g.guardian.fullName,
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {g.relationship}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {t('students.detail.guardians.contactPriority', {
                        priority: g.contactPriority,
                      })}
                    </Badge>
                  </div>
                  {g.contacts.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {g.contacts.map((c) => (
                        <li
                          key={c._id}
                          className="flex items-center gap-2 text-sm"
                        >
                          {c.contactType === 'phone' && (
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          {c.contactType === 'email' && (
                            <Mail className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          {c.contactType === 'zalo' && (
                            <span className="text-xs font-medium text-muted-foreground shrink-0">
                              Zalo
                            </span>
                          )}
                          <span className={c.isPrimary ? 'font-medium' : ''}>
                            {c.value}
                          </span>
                          {c.isPrimary && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1 py-0"
                            >
                              {t('common.primary')}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {g.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {g.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollment History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            {t('students.detail.enrollments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data === undefined ? (
            <div className="flex flex-col gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('students.enrollments.noRecord')}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.enrollments
                .slice()
                .sort((a, b) => b.enrolledDate.localeCompare(a.enrolledDate))
                .map((enrollment, index) => {
                  const statusVariant =
                    enrollment.status === 'active'
                      ? 'default'
                      : enrollment.status === 'on_leave'
                        ? 'secondary'
                        : 'destructive'
                  const isCurrent =
                    enrollment.status === 'active' || index === 0
                  return (
                    <li
                      key={enrollment._id}
                      className="border-b pb-4 last:border-0 last:pb-0"
                    >
                      <Collapsible defaultOpen={isCurrent}>
                        <CollapsibleTrigger className="group flex w-full flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-base">
                                {enrollment.classYear.className}
                              </p>
                              {enrollment.isPrimaryClass && (
                                <Badge variant="outline">
                                  {t('students.detail.isPrimary')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {t('classes.title')}:{' '}
                              {enrollment.classYear.academicYearName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="size-3" />
                              {t('students.detail.enrolledDate')}:{' '}
                              {formatDate(enrollment.enrolledDate)}
                            </p>
                            {enrollment.status === 'withdrawn' &&
                              enrollment.leftDate && (
                                <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                  <Calendar className="size-3" />
                                  {t('students.detail.leftDate')}:{' '}
                                  {formatDate(enrollment.leftDate)}
                                </p>
                              )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusVariant}>
                              {t(`students.status.${enrollment.status}`)}
                            </Badge>
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="rounded-lg bg-muted/30 mt-3">
                          {requesterId && (
                            <EnrollmentSummary
                              studentClassId={enrollment._id}
                              requesterId={requesterId}
                            />
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  )
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
