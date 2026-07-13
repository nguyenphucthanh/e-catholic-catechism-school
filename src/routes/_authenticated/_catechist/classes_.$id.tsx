import {
  Link,
  createFileRoute,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { addDays, format } from 'date-fns'
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  Download,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Printer,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import type { CellValue } from '~/lib/export'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { formatDate } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'
import { exportCsv, exportPdf } from '~/lib/export'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { AttendanceGridBoard } from '~/components/custom/attendance-grid-board'
import { AttendanceSummaryReport } from '~/components/custom/attendance-summary-report'
import { Alert, AlertDescription } from '~/components/ui/alert'
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
import { Badge } from '~/components/ui/badge'
import { Button, buttonVariants } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { EnrollmentDialog } from '~/components/forms/enrollment-dialog'
import { BulkUpdateSacramentDialog } from '~/components/forms/bulk-update-sacrament-dialog'
import { PrintCardsDialog } from '~/components/forms/print-cards-dialog'
import { exportQrCardsPdf } from '~/lib/export/qr-card-pdf'

import { ScoreGridBoard } from '~/components/custom/score-grid-board'
import { EvaluationsBoard } from '~/components/custom/evaluations-board'
import { ProfileAvatar } from '~/components/custom/profile-avatar'

export const Route = createFileRoute('/_authenticated/_catechist/classes_/$id')(
  {
    component: ClassDetailPage,
    validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
      tab: typeof search.tab === 'string' ? search.tab : undefined,
    }),
    staticData: {
      crumbs: [
        { label: 'classes.title', path: '/classes' },
        { label: 'classes.detail.title' },
      ],
    },
  },
)

type StudentRow = {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
  sacramentDates: {
    baptism?: string
    first_confession?: string
    first_communion?: string
    confirmation?: string
  }
}

function ClassDetailPage() {
  const { id } = useParams({ strict: false })
  const { tab } = useSearch({ strict: false })
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const { isInactive } = useInactiveYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const [enrollDialogOpen, setEnrollDialogOpen] = React.useState(false)
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = React.useState(false)
  const [printCardsDialogOpen, setPrintCardsDialogOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<StudentRow | null>(
    null,
  )
  const [sortingState, setSortingState] = React.useState<SortingState>([
    {
      id: 'student_fullName',
      desc: false,
    },
  ])

  const classDetails = useQuery(
    api.classes.getClassDetails,
    requesterId && selectedYearId
      ? {
          requesterId,
          classId: id as Id<'classes'>,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const updateStatus = useMutation(api.students.updateEnrollmentsStatus)
  const appConfig = useQuery(api.appConfig.get)

  const today = format(new Date(), 'yyyy-MM-dd')
  const dateTo = format(addDays(new Date(), 28), 'yyyy-MM-dd')
  const classEvents = useQuery(
    api.calendarEvents.list,
    requesterId && selectedYearId && classDetails?.classYear
      ? {
          requesterId,
          academicYearId: selectedYearId,
          dateFrom: today,
          dateTo,
        }
      : 'skip',
  )
  const classEventsScoped = React.useMemo(
    () =>
      (classEvents ?? [])
        .filter(
          (e) =>
            e.scope === 'class' &&
            e.classYearId === classDetails?.classYear?._id,
        )
        .slice(0, 5),
    [classEvents, classDetails?.classYear?._id],
  )
  const handleRemove = async () => {
    if (!removeTarget || !requesterId) return
    try {
      await updateStatus({
        requesterId,
        studentClassIds: [removeTarget.enrollment._id],
        status: 'withdrawn',
        statusChangedDate: new Date().toISOString().split('T')[0],
      })
      toast.success(t('classes.enrollment.remove.success'))
      setRemoveTarget(null)
    } catch {
      toast.error(t('classes.enrollment.remove.error'))
    }
  }

  const canManage = classDetails?.canManageEnrollments ?? false

  const exportHeaders = React.useMemo<Array<string>>(
    () => [
      t('students.col.stt'),
      t('students.col.saintName'),
      t('students.col.fullName'),
      t('students.col.gender'),
      t('students.col.dateOfBirth'),
    ],
    [t],
  )

  const exportRows = React.useMemo<Array<Record<string, CellValue>>>(() => {
    if (!classDetails?.students) return []
    const result: Array<Record<string, CellValue>> = []
    for (const s of classDetails.students) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!s.student) continue
      result.push({
        [exportHeaders[0]]: result.length + 1,
        [exportHeaders[1]]: s.student.saintName ?? '—',
        [exportHeaders[2]]: s.student.fullName,
        [exportHeaders[3]]: s.student.gender
          ? t(`students.gender.${s.student.gender}`)
          : '—',
        [exportHeaders[4]]: s.student.dateOfBirth
          ? formatDate(s.student.dateOfBirth)
          : '—',
      })
    }
    return result.sort((rowA, rowB) => {
      const nameA = String(rowA[exportHeaders[2]])
      const nameB = String(rowB[exportHeaders[2]])
      const nameFormat = appConfig?.nameFormat

      if (nameFormat === 'firstName_lastName') {
        return nameA
          .toLocaleLowerCase()
          .localeCompare(nameB.toLocaleLowerCase())
      }

      const firstNameA = nameA.split(' ').pop() || ''
      const firstNameB = nameB.split(' ').pop() || ''

      return firstNameA
        .toLocaleLowerCase()
        .localeCompare(firstNameB.toLocaleLowerCase())
    })
  }, [classDetails?.students, t, appConfig?.nameFormat, exportHeaders])

  const pdfMeta = React.useMemo<Record<string, string> | null>(() => {
    if (!classDetails) return null
    return {
      [t('classes.export.catechistsLabel')]: classDetails.assignedCatechists
        .map((a) =>
          formatPersonName(a.catechist.saintName, a.catechist.fullName),
        )
        .join(', '),
      [t('classes.export.totalStudentsLabel')]: String(
        classDetails.studentCount,
      ),
    }
  }, [classDetails, t])

  const columns = React.useMemo<Array<ColumnDef<StudentRow>>>(() => {
    const cols: Array<ColumnDef<StudentRow>> = [
      {
        accessorKey: 'student.studentCode',
        header: t('students.col.studentCode'),
        enableSorting: false,
        cell: ({ row }) => {
          const student = row.original.student
          if (!student) return '—'
          return (
            <Link
              to="/students/$id"
              params={{ id: student._id }}
              className="text-primary hover:underline font-medium"
            >
              {student.studentCode}
            </Link>
          )
        },
      },
      {
        accessorKey: 'student.saintName',
        header: t('students.col.saintName'),
        cell: ({ row }) => row.original.student?.saintName ?? '—',
      },
      {
        id: 'student_fullName',
        accessorKey: 'student.fullName',
        header: t('students.col.fullName'),
        enableSorting: true,
        cell: ({ row }) => {
          const student = row.original.student
          if (!student) return '—'
          return (
            <Link
              to="/students/$id"
              params={{ id: student._id }}
              className="text-primary hover:underline font-medium"
            >
              {student.fullName}
            </Link>
          )
        },
        sortingFn: (rowA, rowB, columnId) => {
          const nameA = String(rowA.getValue(columnId))
          const nameB = String(rowB.getValue(columnId))
          const nameFormat = appConfig?.nameFormat

          if (nameFormat === 'firstName_lastName') {
            return nameA
              .toLocaleLowerCase()
              .localeCompare(nameB.toLocaleLowerCase())
          }

          const firstNameA = nameA.split(' ').pop() || ''
          const firstNameB = nameB.split(' ').pop() || ''

          return firstNameA
            .toLocaleLowerCase()
            .localeCompare(firstNameB.toLocaleLowerCase())
        },
      },
      {
        accessorKey: 'student.gender',
        header: t('students.col.gender'),
        enableSorting: true,
        cell: ({ row }) => {
          const gender = row.original.student?.gender
          return (
            <Badge variant="outline">
              {gender ? t(`students.gender.${gender}`) : '—'}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'student.dateOfBirth',
        header: t('profile.personal.dob'),
        enableSorting: true,
        cell: ({ row }) => {
          const dob = row.original.student?.dateOfBirth
          return dob ? formatDate(dob) : '—'
        },
      },
      {
        accessorKey: 'enrollment.status',
        header: t('students.col.status'),
        enableSorting: true,
        cell: ({ row }) => {
          const status = row.original.enrollment.status
          return (
            <Badge
              variant={
                status === 'active'
                  ? 'default'
                  : status === 'on_leave'
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {t(`students.status.${status}`, { defaultValue: status })}
            </Badge>
          )
        },
      },
      {
        id: 'sacrament_baptism',
        header: t('students.col.baptismDate'),
        cell: ({ row }) => {
          const date = row.original.sacramentDates.baptism
          return date ? formatDate(date) : '—'
        },
      },
      {
        id: 'sacrament_first_confession',
        header: t('students.col.firstConfessionDate'),
        cell: ({ row }) => {
          const date = row.original.sacramentDates.first_confession
          return date ? formatDate(date) : '—'
        },
      },
      {
        id: 'sacrament_first_communion',
        header: t('students.col.firstCommunionDate'),
        cell: ({ row }) => {
          const date = row.original.sacramentDates.first_communion
          return date ? formatDate(date) : '—'
        },
      },
      {
        id: 'sacrament_confirmation',
        header: t('students.col.confirmationDate'),
        cell: ({ row }) => {
          const date = row.original.sacramentDates.confirmation
          return date ? formatDate(date) : '—'
        },
      },
    ]
    if (canManage && !isInactive) {
      cols.push({
        id: 'actions',
        cell: ({ row }) => {
          const enrollment = row.original.enrollment
          if (enrollment.status !== 'active') return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">{t('common.moreActions')}</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-fit">
                <DropdownMenuItem
                  render={
                    <Link
                      to="/students/$id/edit"
                      params={{
                        id: row.original.student?._id as Id<'students'>,
                      }}
                    />
                  }
                >
                  <Pencil className="size-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const student = row.original.student
                    if (!student || !appConfig) return
                    exportQrCardsPdf(
                      [
                        {
                          studentCode: student.studentCode,
                          fullName: student.fullName,
                          saintName: student.saintName,
                        },
                      ],
                      {
                        troopName: appConfig.troopName,
                        parishName: appConfig.parishName,
                        studentCodeLabel: t('printCards.studentCodeLabel'),
                      },
                      `${student.studentCode}-card.pdf`,
                    )
                  }}
                >
                  <Printer className="size-4" />
                  {t('printCards.singleAction')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      to="/students/$id/attendance"
                      params={{
                        id: row.original.student?._id as Id<'students'>,
                      }}
                    />
                  }
                >
                  <CalendarCheck className="size-4" />
                  {t('students.attendance.title')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                  onClick={() => setRemoveTarget(row.original)}
                >
                  {t('classes.enrollment.remove.title')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      })
    }
    return cols
  }, [t, canManage, appConfig])

  if (!classDetails) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const year =
    selectedYearId && selectedYearId.length > 0
      ? selectedYearId.substring(0, 4)
      : ''

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <PageHeader
        icon={GraduationCap}
        title={classDetails.class.name}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <Download className="size-4" />
                  {t('classes.export.title')}
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  exportCsv(
                    exportRows,
                    `${classDetails.class.name}-students.csv`,
                    exportHeaders,
                  )
                }
              >
                {t('classes.export.csv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!pdfMeta) return
                  exportPdf(
                    exportRows,
                    classDetails.class.name,
                    pdfMeta,
                    `${classDetails.class.name}-students.pdf`,
                    exportHeaders,
                  )
                }}
              >
                {t('classes.export.pdf')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {isInactive && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="size-4 shrink-0" />
          <AlertDescription>
            {t('classes.detail.pastYearWarning')}
          </AlertDescription>
        </Alert>
      )}

      {classDetails.classYear === null && (
        <Alert>
          <AlertDescription>
            {t('classes.detail.notActivated', { year })}
          </AlertDescription>
        </Alert>
      )}

      {classDetails.classYear !== null && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('classes.detail.catechists.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classDetails.assignedCatechists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('classes.detail.catechists.empty')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {classDetails.assignedCatechists
                      .sort((a) => (a.role === 'homeroom' ? -1 : 1))
                      .map((assignment) => (
                        <Link
                          key={assignment.catechist._id}
                          className="flex items-center gap-3 rounded-lg border p-3 group"
                          to={'/catechists/$id'}
                          params={{ id: assignment.catechist._id }}
                        >
                          <ProfileAvatar
                            className="size-10!"
                            userType={'catechist'}
                            userId={assignment.catechist._id}
                            fullName={assignment.catechist.fullName}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-primary group-hover:underline">
                              {formatPersonName(
                                assignment.catechist.saintName,
                                assignment.catechist.fullName,
                              )}
                            </p>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {assignment.role === 'homeroom'
                                ? t('classes.detail.catechists.homeroom')
                                : t('classes.detail.catechists.coTeacher')}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t('classes.detail.students.count')}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('classes.detail.students.countDesc')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {classDetails.studentCount}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('classes.detail.students.unit')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="size-5 text-muted-foreground" />
                  {t('classes.detail.upcomingEvents.title')}
                </CardTitle>
                <Link
                  to="/calendar-events"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {t('classes.detail.upcomingEvents.viewAll')}
                </Link>
              </CardHeader>
              <CardContent>
                {classEvents === undefined ? (
                  <Skeleton className="h-20 w-full" />
                ) : classEventsScoped.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('classes.detail.upcomingEvents.empty')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {classEventsScoped.map((event) => (
                      <div
                        key={event._id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <span
                          className="inline-flex shrink-0"
                          title={t(`calendarEvents.severity.${event.severity}`)}
                        >
                          {event.severity === 'high' && (
                            <SignalHigh className="size-5 text-destructive" />
                          )}
                          {event.severity === 'medium' && (
                            <SignalMedium className="size-5 text-yellow-600 dark:text-yellow-400" />
                          )}
                          {event.severity === 'low' && (
                            <SignalLow className="size-5 text-muted-foreground" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {formatDate(event.date)}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {(() => {
                              try {
                                const doc = JSON.parse(event.description)
                                const parts: Array<string> = []
                                const walk = (node: unknown) => {
                                  if (!node || typeof node !== 'object') return
                                  const { text, content } = node as {
                                    text?: unknown
                                    content?: unknown
                                  }
                                  if (typeof text === 'string') parts.push(text)
                                  if (Array.isArray(content))
                                    content.forEach(walk)
                                }
                                walk(doc)
                                return parts.join(' ').trim()
                              } catch {
                                return event.description
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs
            defaultValue={tab === 'attendance' ? 'attendance' : 'students'}
            className="w-full"
          >
            <TabsList className="md:grid w-full grid-cols-3 overflow-hidden overflow-x-auto">
              <TabsTrigger value="students">
                {t('classes.detail.tabs.students')}
              </TabsTrigger>
              <TabsTrigger value="attendance">
                {t('classes.detail.tabs.attendance')}
              </TabsTrigger>
              <TabsTrigger value="exams">
                {t('classes.detail.tabs.exams')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="mt-6">
              <div className="mb-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPrintCardsDialogOpen(true)}
                >
                  <Printer className="size-4" />
                  {t('printCards.buttonLabel')}
                </Button>
                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setBulkUpdateDialogOpen(true)}
                    >
                      {t('classes.sacraments.bulkUpdate.buttonLabel')}
                    </Button>
                    {!isInactive && (
                      <Button onClick={() => setEnrollDialogOpen(true)}>
                        {t('classes.enrollment.buttonLabel')}
                      </Button>
                    )}
                  </>
                )}
              </div>
              <Card>
                <CardContent>
                  <DataTable
                    columns={columns}
                    data={classDetails.students}
                    searchColumnKey="student_fullName"
                    sorting={sortingState}
                    onSortingChange={setSortingState}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams" className="mt-6 min-w-0">
              {requesterId && selectedYearId ? (
                <Tabs defaultValue="scores">
                  <TabsList>
                    <TabsTrigger value="scores">
                      {t('exams.subtabs.scores')}
                    </TabsTrigger>
                    <TabsTrigger value="evaluations">
                      {t('exams.subtabs.evaluations')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="scores" className="mt-4 min-w-0">
                    <Card>
                      <CardContent>
                        <ScoreGridBoard
                          classId={id as Id<'classes'>}
                          academicYearId={selectedYearId}
                          requesterId={requesterId}
                          canManage={canManage && !isInactive}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="evaluations" className="mt-4 min-w-0">
                    <Card>
                      <CardContent>
                        <EvaluationsBoard
                          classYearId={classDetails.classYear._id}
                          academicYearId={selectedYearId}
                          requesterId={requesterId}
                          canManage={canManage && !isInactive}
                          students={classDetails.students}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : null}
            </TabsContent>

            <TabsContent value="attendance" className="mt-6 min-w-0">
              {requesterId && selectedYearId ? (
                <Tabs defaultValue="grid">
                  <TabsList>
                    <TabsTrigger value="grid">
                      {t('attendance.tabs.grid')}
                    </TabsTrigger>
                    <TabsTrigger value="summary">
                      {t('attendance.tabs.summary')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="grid" className="mt-4 min-w-0">
                    <Card>
                      <CardContent>
                        <AttendanceGridBoard
                          classId={id as Id<'classes'>}
                          academicYearId={selectedYearId}
                          requesterId={requesterId}
                          canManage={canManage && !isInactive}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="summary" className="mt-4 min-w-0">
                    <AttendanceSummaryReport
                      classId={id as Id<'classes'>}
                      academicYearId={selectedYearId}
                      requesterId={requesterId}
                    />
                  </TabsContent>
                </Tabs>
              ) : null}
            </TabsContent>
          </Tabs>

          <EnrollmentDialog
            isOpen={enrollDialogOpen}
            onOpenChange={setEnrollDialogOpen}
            classYearId={classDetails.classYear._id}
            className={classDetails.class.name}
          />

          <BulkUpdateSacramentDialog
            isOpen={bulkUpdateDialogOpen}
            onOpenChange={setBulkUpdateDialogOpen}
            classYearId={classDetails.classYear._id}
            className={classDetails.class.name}
            students={classDetails.students}
          />

          <PrintCardsDialog
            isOpen={printCardsDialogOpen}
            onOpenChange={setPrintCardsDialogOpen}
            title={classDetails.class.name}
            students={classDetails.students
              .filter((s) => s.enrollment.status === 'active')
              .map((s) => ({
                _id: s.student._id,
                fullName: s.student.fullName,
                saintName: s.student.saintName,
                studentCode: s.student.studentCode,
              }))}
            filename={`${classDetails.class.name}-cards.pdf`}
          />

          <AlertDialog
            open={removeTarget !== null}
            onOpenChange={(open) => {
              if (!open) setRemoveTarget(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('classes.enrollment.remove.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('classes.enrollment.remove.description', {
                    student: removeTarget
                      ? formatPersonName(
                          removeTarget.student?.saintName ?? null,
                          removeTarget.student?.fullName ?? '',
                        )
                      : '',
                    class: classDetails.class.name,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('classes.enrollment.remove.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
