import { Link, createFileRoute, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, MoreHorizontal } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { ColumnDef } from '@tanstack/react-table'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { useAuth } from '~/lib/auth'
import { formatDate } from '~/lib/locale'
import { formatPersonName } from '~/lib/name'
import { PageHeader } from '~/components/page-header'
import { DataTable } from '~/components/custom/data-table'
import { AttendanceGridBoard } from '~/components/custom/attendance-grid-board'
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
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
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

export const Route = createFileRoute('/_authenticated/classes_/$id')({
  component: ClassDetailPage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'classes.detail.title' },
    ],
  },
})

type StudentRow = {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

function ClassDetailPage() {
  const { id } = useParams({ strict: false })
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const [enrollDialogOpen, setEnrollDialogOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<StudentRow | null>(
    null,
  )

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

  const columns = React.useMemo<Array<ColumnDef<StudentRow>>>(() => {
    const cols: Array<ColumnDef<StudentRow>> = [
      {
        accessorKey: 'student.studentCode',
        header: t('students.col.studentCode'),
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
        cell: ({ row }) => row.original.student?.fullName ?? '—',
      },
      {
        accessorKey: 'student.gender',
        header: t('students.col.gender'),
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
        cell: ({ row }) => {
          const dob = row.original.student?.dateOfBirth
          return dob ? formatDate(dob) : '—'
        },
      },
      {
        accessorKey: 'enrollment.status',
        header: t('students.col.status'),
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
    ]
    if (canManage) {
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
              <DropdownMenuContent align="end" className="w-48">
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
  }, [t, canManage])

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
      <PageHeader icon={GraduationCap} title={classDetails.class.name} />

      {classDetails.classYear === null && (
        <Alert>
          <AlertDescription>
            {t('classes.detail.notActivated', { year })}
          </AlertDescription>
        </Alert>
      )}

      {classDetails.classYear !== null && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
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
                        <div
                          key={assignment.catechist._id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {formatPersonName(
                                assignment.catechist.saintName,
                                assignment.catechist.fullName,
                              ).charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
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
                        </div>
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
          </div>

          <Tabs defaultValue="students" className="w-full">
            <TabsList className="md:grid w-full grid-cols-3 overflow-hidden overflow-x-auto">
              <TabsTrigger value="students">
                {t('classes.detail.tabs.students')}
              </TabsTrigger>
              <TabsTrigger value="exams">
                {t('classes.detail.tabs.exams')}
              </TabsTrigger>
              <TabsTrigger value="attendance">
                {t('classes.detail.tabs.attendance')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="mt-6">
              <div className="mb-4 flex justify-end">
                <Button onClick={() => setEnrollDialogOpen(true)}>
                  {t('classes.enrollment.buttonLabel')}
                </Button>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <DataTable
                    columns={columns}
                    data={classDetails.students}
                    searchColumnKey="student_fullName"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="font-semibold">
                      {t('classes.detail.placeholder.comingSoon')}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('classes.detail.placeholder.desc')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="mt-6 min-w-0">
              {requesterId && selectedYearId && classDetails.classYear ? (
                <AttendanceGridBoard
                  classId={id as Id<'classes'>}
                  academicYearId={selectedYearId}
                  requesterId={requesterId}
                />
              ) : null}
            </TabsContent>
          </Tabs>

          <EnrollmentDialog
            isOpen={enrollDialogOpen}
            onOpenChange={setEnrollDialogOpen}
            classYearId={classDetails.classYear._id}
            className={classDetails.class.name}
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
