import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, GraduationCap, Search } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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
import { Card, CardContent } from '~/components/ui/card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group'

export const Route = createFileRoute(
  '/_authenticated/_catechist/classes_/$id_/exams_/create',
)({
  component: CreateExamPage,
  staticData: {
    crumbs: [
      { label: 'classes.title', path: '/classes' },
      { label: 'exams.create.title' },
    ],
  },
})

interface StudentScoreInput {
  studentId: Id<'students'>
  scoreValue?: number
  scoreLabel?: string
}

function CreateExamPage() {
  const { id: classId } = useParams({ strict: false })
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  // Form State
  const [columnName, setColumnName] = React.useState('')
  const [columnType, setColumnType] = React.useState('')
  const [scaleType, setScaleType] = React.useState<
    'scale_10' | 'pass_fail' | 'letter_af'
  >('scale_10')
  const [semesterId, setSemesterId] = React.useState<string>('')
  const [weight, setWeight] = React.useState('1')
  const [examDate, setExamDate] = React.useState('')
  const [sortOrder, setSortOrder] = React.useState('1')

  // Student Scores state: Map of studentId -> score data
  const [scoresMap, setScoresMap] = React.useState<
    Record<string, { value?: number; label?: string }>
  >({})
  const [searchQuery, setSearchQuery] = React.useState('')
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Fetch Class Details
  const classDetails = useQuery(
    api.classes.getClassDetails,
    requesterId && selectedYearId && classId
      ? {
          requesterId,
          classId: classId as Id<'classes'>,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  // Fetch Semesters
  const semesters = useQuery(
    api.academicYears.listSemesters,
    requesterId && selectedYearId
      ? {
          requesterId,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const createExamWithScores = useMutation(api.grading.createColumnWithScores)

  const semesterOptions = React.useMemo(() => {
    if (!semesters || semesters.length === 0) return []
    return semesters.map((sem) => ({
      label:
        sem.name ?? t('semesters.numberLabel', { number: sem.semesterNumber }),
      value: sem._id,
    }))
  }, [semesters, t])

  React.useEffect(() => {
    if (semesterOptions.length > 0 && !semesterId) {
      setSemesterId(semesterOptions[0].value)
    }
  }, [semesterOptions, semesterId])

  const defaultSemesterId = semesterOptions[0]?.value || ''

  // Compute dirty flag
  const isDirty = React.useMemo(() => {
    if (columnName !== '') return true
    if (semesterId && semesterId !== defaultSemesterId) return true
    if (columnType !== 'short_quiz') return true
    if (scaleType !== 'scale_10') return true
    if (weight !== '1') return true
    if (examDate !== '') return true
    if (sortOrder !== '1') return true
    return Object.values(scoresMap).some(
      (s) => s.value !== undefined || s.label !== undefined,
    )
  }, [
    columnName,
    semesterId,
    defaultSemesterId,
    columnType,
    scaleType,
    weight,
    examDate,
    sortOrder,
    scoresMap,
  ])

  // Filtered Students
  const filteredStudents = React.useMemo(() => {
    if (!classDetails?.students) return []
    const query = searchQuery.trim().toLowerCase()
    if (!query) return classDetails.students

    return classDetails.students.filter((s) => {
      const name = s.student.fullName.toLowerCase()
      const saint = (s.student.saintName || '').toLowerCase()
      const code = s.student.studentCode.toLowerCase()
      return (
        name.includes(query) || saint.includes(query) || code.includes(query)
      )
    })
  }, [classDetails?.students, searchQuery])

  const handleBack = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true)
    } else {
      void navigate({ to: `/classes/${classId}` })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requesterId || !classDetails?.classYear || !semesterId) return

    if (!columnName.trim()) {
      toast.error('Vui lòng nhập tên cột điểm')
      return
    }

    setIsSubmitting(true)
    try {
      const scoresPayload: Array<StudentScoreInput> = classDetails.students.map(
        (s) => {
          const record =
            (
              scoresMap as Record<
                string,
                (typeof scoresMap)[string] | undefined
              >
            )[s.student._id] ?? {}
          return {
            studentId: s.student._id,
            scoreValue: scaleType === 'scale_10' ? record.value : undefined,
            scoreLabel: scaleType !== 'scale_10' ? record.label : undefined,
          }
        },
      )

      await createExamWithScores({
        requesterId,
        classYearId: classDetails.classYear._id,
        semesterId: semesterId as Id<'semesters'>,
        columnName: columnName.trim(),
        columnType,
        scaleType,
        weight: parseInt(weight) || 1,
        examDate: examDate || undefined,
        sortOrder: parseInt(sortOrder) || 1,
        scores: scoresPayload,
      })

      toast.success(t('exams.create.success'))
      void navigate({ to: `/classes/${classId}` })
    } catch (err: any) {
      toast.error(err.message || t('common.error'))
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!classDetails || !semesters) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader icon={GraduationCap} title={t('exams.create.title')} />
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-24 min-w-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          icon={GraduationCap}
          title={t('exams.create.title')}
          subtitle={classDetails.class.name}
        />
      </div>

      {/* Exam Metadata Card */}
      <Card>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label
                htmlFor="column-name"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.name')}
              </label>
              <Input
                id="column-name"
                type="text"
                placeholder="Ví dụ: Chúa nhật 15"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="exam-semester"
                className="text-sm font-medium mb-1 block"
              >
                {t('attendance.createSession.semester')}
              </label>
              <Select
                value={semesterId}
                onValueChange={(val) => setSemesterId(val || '')}
                items={semesterOptions}
              >
                <SelectTrigger id="exam-semester" className="w-full">
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="exam-type"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.type')}
              </label>
              <datalist id="exam-type-suggestions">
                <option value={t('exams.create.type.short_quiz')} />
                <option value={t('exams.create.type.midterm_test')} />
                <option value={t('exams.create.type.semester_exam')} />
              </datalist>
              <Input
                id="exam-type"
                list="exam-type-suggestions"
                value={columnType}
                onChange={(e) => setColumnType(e.target.value)}
                placeholder={t('exams.create.type.placeholder')}
                className="w-full"
              />
            </div>

            <div>
              <label
                htmlFor="scale-type"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.scale')}
              </label>
              <Select
                value={scaleType}
                onValueChange={(val: any) => setScaleType(val)}
                items={[
                  {
                    label: t('exams.create.scale.scale_10'),
                    value: 'scale_10',
                  },
                  {
                    label: t('exams.create.scale.pass_fail'),
                    value: 'pass_fail',
                  },
                  {
                    label: t('exams.create.scale.letter_af'),
                    value: 'letter_af',
                  },
                ]}
              >
                <SelectTrigger id="scale-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scale_10">
                    {t('exams.create.scale.scale_10')}
                  </SelectItem>
                  <SelectItem value="pass_fail">
                    {t('exams.create.scale.pass_fail')}
                  </SelectItem>
                  <SelectItem value="letter_af">
                    {t('exams.create.scale.letter_af')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="exam-weight"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.weight')}
              </label>
              <Input
                id="exam-weight"
                type="number"
                min={1}
                max={3}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="exam-date"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.examDate')}
              </label>
              <Input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="sort-order"
                className="text-sm font-medium mb-1 block"
              >
                {t('exams.create.sortOrder')}
              </label>
              <Input
                id="sort-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                required
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Student List */}
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Nhập điểm số cho học viên</h3>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground bg-card">
          {t('common.noResultsFound')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(({ student }) => {
            const scRecord =
              (
                scoresMap as Record<
                  string,
                  (typeof scoresMap)[string] | undefined
                >
              )[student._id] ?? {}
            const fullName =
              student.saintName && student.fullName
                ? `${student.saintName} ${student.fullName}`
                : student.fullName

            return (
              <div
                key={student._id}
                className="border rounded-xl p-3 bg-card shadow-sm flex items-center justify-between gap-4 h-20"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {fullName}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {student.studentCode}
                  </div>
                </div>

                <div className="w-32 shrink-0">
                  {scaleType === 'scale_10' && (
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      placeholder="0.0 - 10.0"
                      value={scRecord.value !== undefined ? scRecord.value : ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setScoresMap((prev) => ({
                          ...prev,
                          [student._id]: {
                            ...prev[student._id],
                            value: val !== '' ? parseFloat(val) : undefined,
                          },
                        }))
                      }}
                      className="h-8 text-xs text-center"
                    />
                  )}
                  {scaleType === 'pass_fail' && (
                    <Select
                      value={scRecord.label || 'none'}
                      onValueChange={(val) => {
                        const label = val && val !== 'none' ? val : undefined
                        setScoresMap((prev) => ({
                          ...prev,
                          [student._id]: {
                            ...prev[student._id],
                            label,
                          },
                        }))
                      }}
                      items={[
                        { label: 'Chưa nhập', value: 'none' },
                        { label: 'Đạt', value: 'pass' },
                        { label: 'Không đạt', value: 'fail' },
                      ]}
                    >
                      <SelectTrigger className="h-8 text-xs bg-transparent w-full">
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Chưa nhập</SelectItem>
                        <SelectItem value="pass">Đạt</SelectItem>
                        <SelectItem value="fail">Không đạt</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {scaleType === 'letter_af' && (
                    <Input
                      type="text"
                      placeholder="Ví dụ: A+, B-"
                      value={scRecord.label || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setScoresMap((prev) => ({
                          ...prev,
                          [student._id]: {
                            ...prev[student._id],
                            label: val || undefined,
                          },
                        }))
                      }}
                      className="h-8 text-xs text-center font-bold"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-[var(--sidebar-width)] z-50 p-4 border-t bg-background/85 backdrop-blur shadow-lg flex items-center gap-4 transition-[left] ease-linear duration-200">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            placeholder={t('exams.create.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isSubmitting}
            className="h-9"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !semesterId || !columnName.trim()}
            className="h-9"
          >
            {isSubmitting ? t('common.saving') : t('exams.create.submit')}
          </Button>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendance.createSession.confirmLeaveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendance.createSession.confirmLeaveDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                void navigate({ to: `/classes/${classId}` })
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('classes.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
