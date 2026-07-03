import * as React from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

type StudentRow = {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

interface EvaluationsBoardProps {
  classYearId: Id<'classYears'>
  academicYearId: Id<'academicYears'>
  requesterId: Id<'catechists'>
  canManage?: boolean
  students: Array<StudentRow>
}

// Morality & Conduct options
const MORALITY_OPTIONS = [
  { value: 'excellent', labelKey: 'evaluations.morality.excellent' },
  { value: 'good', labelKey: 'evaluations.morality.good' },
  { value: 'average', labelKey: 'evaluations.morality.average' },
  { value: 'below_average', labelKey: 'evaluations.morality.below_average' },
  { value: 'poor', labelKey: 'evaluations.morality.poor' },
]

export function EvaluationsBoard({
  classYearId,
  academicYearId,
  requesterId,
  canManage = false,
  students,
}: EvaluationsBoardProps) {
  const { t } = useTranslation()

  // Fetch semesters
  const semesters = useQuery(api.academicYears.listSemesters, {
    requesterId,
    academicYearId,
  })

  // Semester Docs
  const sem1 = semesters?.find((s) => s.semesterNumber === 1)
  const sem2 = semesters?.find((s) => s.semesterNumber === 2)

  // Fetch Semester Results for Sem 1
  const sem1Results = useQuery(
    api.grading.listSemesterResults,
    requesterId && sem1
      ? {
          requesterId,
          classYearId,
          semesterId: sem1._id,
        }
      : 'skip',
  )

  // Fetch Semester Results for Sem 2
  const sem2Results = useQuery(
    api.grading.listSemesterResults,
    requesterId && sem2
      ? {
          requesterId,
          classYearId,
          semesterId: sem2._id,
        }
      : 'skip',
  )

  // Fetch Annual Results
  const annualResults = useQuery(
    api.grading.listAnnualResults,
    requesterId
      ? {
          requesterId,
          classYearId,
        }
      : 'skip',
  )

  // Batch Mutations
  const saveSemesterResult = useMutation(api.grading.upsertSemesterResult)
  const saveAnnualResult = useMutation(api.grading.upsertAnnualResult)

  // Local state for modified fields
  const [semester1State, setSemester1State] = React.useState<
    Record<
      string,
      { morality?: string; teacherNote: string; isCompleted: boolean }
    >
  >({})
  const [semester2State, setSemester2State] = React.useState<
    Record<
      string,
      { morality?: string; teacherNote: string; isCompleted: boolean }
    >
  >({})
  const [annualState, setAnnualState] = React.useState<
    Record<
      string,
      { conductGrade?: string; remark: string; isCompleted: boolean }
    >
  >({})

  const [isSaving, setIsSaving] = React.useState(false)

  // Initialize state once backend data is loaded
  React.useEffect(() => {
    if (sem1Results) {
      const state: typeof semester1State = {}
      sem1Results.forEach((r) => {
        state[r.studentClassId] = {
          morality: r.morality || undefined,
          teacherNote: r.teacherNote || '',
          isCompleted: r.isCompleted || false,
        }
      })
      setSemester1State((prev) => ({ ...state, ...prev }))
    }
  }, [sem1Results])

  React.useEffect(() => {
    if (sem2Results) {
      const state: typeof semester2State = {}
      sem2Results.forEach((r) => {
        state[r.studentClassId] = {
          morality: r.morality || undefined,
          teacherNote: r.teacherNote || '',
          isCompleted: r.isCompleted || false,
        }
      })
      setSemester2State((prev) => ({ ...state, ...prev }))
    }
  }, [sem2Results])

  React.useEffect(() => {
    if (annualResults) {
      const state: typeof annualState = {}
      annualResults.forEach((r) => {
        state[r.studentClassId] = {
          conductGrade: r.conductGrade || undefined,
          remark: r.remark || '',
          isCompleted: r.isCompleted || false,
        }
      })
      setAnnualState((prev) => ({ ...state, ...prev }))
    }
  }, [annualResults])

  const isLoading =
    semesters === undefined ||
    sem1Results === undefined ||
    sem2Results === undefined ||
    annualResults === undefined

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const activeStudents = students.filter(
    (s) => s.student && s.enrollment.status === 'active',
  )

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      // Save Semester 1 Results
      if (sem1) {
        for (const [studentClassId, rowState] of Object.entries(
          semester1State,
        )) {
          await saveSemesterResult({
            requesterId,
            studentClassId: studentClassId as Id<'studentClasses'>,
            semesterId: sem1._id,
            morality: rowState.morality as any,
            teacherNote: rowState.teacherNote,
            isCompleted: rowState.isCompleted,
          })
        }
      }

      // Save Semester 2 Results
      if (sem2) {
        for (const [studentClassId, rowState] of Object.entries(
          semester2State,
        )) {
          await saveSemesterResult({
            requesterId,
            studentClassId: studentClassId as Id<'studentClasses'>,
            semesterId: sem2._id,
            morality: rowState.morality as any,
            teacherNote: rowState.teacherNote,
            isCompleted: rowState.isCompleted,
          })
        }
      }

      // Save Annual Results
      for (const [studentClassId, rowState] of Object.entries(annualState)) {
        await saveAnnualResult({
          requesterId,
          studentClassId: studentClassId as Id<'studentClasses'>,
          conductGrade: rowState.conductGrade as any,
          remark: rowState.remark,
          isCompleted: rowState.isCompleted,
        })
      }

      toast.success(t('evaluations.saveSuccess'))
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu bảng đánh giá')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 min-w-0">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-semibold">{t('evaluations.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-normal">
            Nhập hạnh kiểm, nhận xét học kỳ và đánh giá kết quả cuối năm học
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-9"
          >
            <Save className="h-4 w-4" />
            <span>{t('evaluations.saveBtn')}</span>
          </Button>
        )}
      </div>

      <div className="w-full rounded-lg border bg-card overflow-x-auto max-h-[600px]">
        <table className="border-collapse w-full min-w-[900px] text-xs">
          <thead>
            {/* Header Row 1 */}
            <tr className="bg-muted/50 border-b">
              <th
                rowSpan={2}
                className="sticky left-0 bg-background p-3 text-left font-semibold border-r"
                style={{ width: '220px' }}
              >
                Học viên
              </th>
              <th
                colSpan={3}
                className="p-2 border-r text-center font-semibold text-primary"
              >
                {t('evaluations.semester1')} (HK1)
              </th>
              {sem2 && (
                <th
                  colSpan={3}
                  className="p-2 border-r text-center font-semibold text-primary"
                >
                  {t('evaluations.semester2')} (HK2)
                </th>
              )}
              <th
                colSpan={3}
                className="p-2 text-center font-semibold text-indigo-600"
              >
                {t('evaluations.annual')} (Cả Năm)
              </th>
            </tr>
            {/* Header Row 2 */}
            <tr className="bg-muted/30 border-b">
              {/* Semester 1 */}
              <th className="p-2 border-r text-center font-medium text-muted-foreground w-32">
                Hạnh kiểm
              </th>
              <th className="p-2 border-r text-center font-medium text-muted-foreground">
                Ghi chú/Nhận xét
              </th>
              <th className="p-2 border-r text-center font-medium text-muted-foreground w-20">
                Đạt HK1
              </th>
              {/* Semester 2 */}
              {sem2 && (
                <>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground w-32">
                    Hạnh kiểm
                  </th>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground">
                    Ghi chú/Nhận xét
                  </th>
                  <th className="p-2 border-r text-center font-medium text-muted-foreground w-20">
                    Đạt HK2
                  </th>
                </>
              )}
              {/* Annual */}
              <th className="p-2 border-r text-center font-medium text-muted-foreground w-32">
                Xếp loại
              </th>
              <th className="p-2 border-r text-center font-medium text-muted-foreground">
                Ghi chú cả năm
              </th>
              <th className="p-2 text-center font-medium text-muted-foreground w-20">
                Lên lớp
              </th>
            </tr>
          </thead>

          <tbody>
            {activeStudents.map(({ enrollment, student }) => {
              if (!student) return null
              const scId = enrollment._id
              const s1 = (
                semester1State as Record<
                  string,
                  | {
                      morality?: string
                      teacherNote: string
                      isCompleted: boolean
                    }
                  | undefined
                >
              )[scId] ?? {
                morality: undefined,
                teacherNote: '',
                isCompleted: false,
              }
              const s2 = (
                semester2State as Record<
                  string,
                  | {
                      morality?: string
                      teacherNote: string
                      isCompleted: boolean
                    }
                  | undefined
                >
              )[scId] ?? {
                morality: undefined,
                teacherNote: '',
                isCompleted: false,
              }
              const ann = (
                annualState as Record<
                  string,
                  | {
                      conductGrade?: string
                      remark: string
                      isCompleted: boolean
                    }
                  | undefined
                >
              )[scId] ?? {
                conductGrade: undefined,
                remark: '',
                isCompleted: false,
              }

              const fullName =
                student.saintName && student.fullName
                  ? `${student.saintName} ${student.fullName}`
                  : student.fullName

              return (
                <tr
                  key={scId}
                  className="hover:bg-accent/30 border-b last:border-b-0"
                >
                  {/* Student Name */}
                  <td className="sticky left-0 bg-background p-2.5 font-medium border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="font-semibold text-foreground truncate max-w-[200px]">
                      {fullName}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {student.studentCode}
                    </div>
                  </td>

                  {/* HK1 Morality */}
                  <td className="p-1 border-r text-center">
                    <Select
                      value={s1.morality || 'none'}
                      onValueChange={(val) => {
                        const morality = val && val !== 'none' ? val : undefined
                        setSemester1State((prev) => ({
                          ...prev,
                          [scId]: {
                            ...((prev as Record<string, typeof s1 | undefined>)[
                              scId
                            ] ?? s1),
                            morality,
                          },
                        }))
                      }}
                      disabled={!canManage || isSaving}
                      items={[
                        { label: 'Chưa xếp', value: 'none' },
                        ...MORALITY_OPTIONS.map((opt) => ({
                          label: t(opt.labelKey),
                          value: opt.value,
                        })),
                      ]}
                    >
                      <SelectTrigger className="h-7 text-xs w-full bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="none">Chưa xếp</SelectItem>
                        {MORALITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* HK1 Note */}
                  <td className="p-1 border-r">
                    <Input
                      value={s1.teacherNote}
                      onChange={(e) =>
                        setSemester1State((prev) => ({
                          ...prev,
                          [scId]: {
                            ...((prev as Record<string, typeof s1 | undefined>)[
                              scId
                            ] ?? s1),
                            teacherNote: e.target.value,
                          },
                        }))
                      }
                      disabled={!canManage || isSaving}
                      className="h-7 text-xs w-full bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Nhận xét..."
                    />
                  </td>
                  {/* HK1 Completed */}
                  <td className="p-1 border-r text-center">
                    <Label className="cursor-pointer w-full h-[40px] flex items-center justify-center">
                      <Checkbox
                        checked={s1.isCompleted}
                        onCheckedChange={(checked) =>
                          setSemester1State((prev) => ({
                            ...prev,
                            [scId]: {
                              ...((
                                prev as Record<string, typeof s1 | undefined>
                              )[scId] ?? s1),
                              isCompleted: checked,
                            },
                          }))
                        }
                        disabled={!canManage || isSaving}
                      />
                    </Label>
                  </td>

                  {/* HK2 */}
                  {sem2 && (
                    <>
                      {/* HK2 Morality */}
                      <td className="p-1 border-r text-center">
                        <Select
                          value={s2.morality || 'none'}
                          onValueChange={(val) => {
                            const morality =
                              val && val !== 'none' ? val : undefined
                            setSemester2State((prev) => ({
                              ...prev,
                              [scId]: {
                                ...((
                                  prev as Record<string, typeof s2 | undefined>
                                )[scId] ?? s2),
                                morality,
                              },
                            }))
                          }}
                          disabled={!canManage || isSaving}
                          items={[
                            { label: 'Chưa xếp', value: 'none' },
                            ...MORALITY_OPTIONS.map((opt) => ({
                              label: t(opt.labelKey),
                              value: opt.value,
                            })),
                          ]}
                        >
                          <SelectTrigger className="h-7 text-xs w-full bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value="none">Chưa xếp</SelectItem>
                            {MORALITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(opt.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* HK2 Note */}
                      <td className="p-1 border-r">
                        <Input
                          value={s2.teacherNote}
                          onChange={(e) =>
                            setSemester2State((prev) => ({
                              ...prev,
                              [scId]: {
                                ...((
                                  prev as Record<string, typeof s2 | undefined>
                                )[scId] ?? s2),
                                teacherNote: e.target.value,
                              },
                            }))
                          }
                          disabled={!canManage || isSaving}
                          className="h-7 text-xs w-full bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Nhận xét..."
                        />
                      </td>
                      {/* HK2 Completed */}
                      <td className="p-1 border-r text-center">
                        <Label className="cursor-pointer w-full h-[40px] flex items-center justify-center">
                          <Checkbox
                            checked={s2.isCompleted}
                            onCheckedChange={(checked) =>
                              setSemester2State((prev) => ({
                                ...prev,
                                [scId]: {
                                  ...((
                                    prev as Record<
                                      string,
                                      typeof s2 | undefined
                                    >
                                  )[scId] ?? s2),
                                  isCompleted: checked,
                                },
                              }))
                            }
                            disabled={!canManage || isSaving}
                          />
                        </Label>
                      </td>
                    </>
                  )}

                  {/* Annual Conduct */}
                  <td className="p-1 border-r text-center">
                    <Select
                      value={ann.conductGrade || 'none'}
                      onValueChange={(val) => {
                        const conductGrade =
                          val && val !== 'none' ? val : undefined
                        setAnnualState((prev) => ({
                          ...prev,
                          [scId]: {
                            ...((
                              prev as Record<string, typeof ann | undefined>
                            )[scId] ?? ann),
                            conductGrade,
                          },
                        }))
                      }}
                      disabled={!canManage || isSaving}
                      items={[
                        { label: 'Chưa xếp', value: 'none' },
                        ...MORALITY_OPTIONS.map((opt) => ({
                          label: t(opt.labelKey),
                          value: opt.value,
                        })),
                      ]}
                    >
                      <SelectTrigger className="h-7 text-xs w-full bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="none">Chưa xếp</SelectItem>
                        {MORALITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Annual Remark */}
                  <td className="p-1 border-r">
                    <Input
                      value={ann.remark}
                      onChange={(e) =>
                        setAnnualState((prev) => ({
                          ...prev,
                          [scId]: {
                            ...((
                              prev as Record<string, typeof ann | undefined>
                            )[scId] ?? ann),
                            remark: e.target.value,
                          },
                        }))
                      }
                      disabled={!canManage || isSaving}
                      className="h-7 text-xs w-full bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Nhận xét cả năm..."
                    />
                  </td>
                  {/* Annual Completed */}
                  <td className="p-1 text-center">
                    <Label className="cursor-pointer w-full h-[40px] flex items-center justify-center">
                      <Checkbox
                        checked={ann.isCompleted}
                        onCheckedChange={(checked) =>
                          setAnnualState((prev) => ({
                            ...prev,
                            [scId]: {
                              ...((
                                prev as Record<string, typeof ann | undefined>
                              )[scId] ?? ann),
                              isCompleted: checked,
                            },
                          }))
                        }
                        disabled={!canManage || isSaving}
                      />
                    </Label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
