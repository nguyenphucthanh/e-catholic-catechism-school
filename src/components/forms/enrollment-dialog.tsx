import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useConvex, useMutation } from 'convex/react'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import { translateConvexError } from '~/lib/convex-errors'
import { useOneShotQuery } from '~/hooks/use-one-shot-query'
import { formatPersonName } from '~/lib/name'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { formatDate } from '~/lib/locale'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MIN_CHARS = 2

type SearchResult = FunctionReturnType<
  typeof api.students.searchEligibleStudents
>[number]
type Enrollment = NonNullable<
  FunctionReturnType<typeof api.students.getStudentEnrollmentForYear>
>
type SelectedStudent = SearchResult & { className: string | null }

interface EnrollmentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  classYearId: Id<'classYears'>
  academicYearId: Id<'academicYears'>
  className: string
  isPrimary?: boolean
}

export function EnrollmentDialog({
  isOpen,
  onOpenChange,
  classYearId,
  academicYearId,
  className,
  isPrimary = true,
}: EnrollmentDialogProps) {
  const { t } = useTranslation()

  const enrollMutation = useMutation(api.students.enrollStudents)

  const convex = useConvex()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => clearTimeout(id)
  }, [searchQuery])

  // Backend search per debounced term; one-shot so writes elsewhere don't
  // re-run it.
  const { data: searchResults } = useOneShotQuery(
    api.students.searchEligibleStudents,
    isOpen && debouncedQuery.length >= SEARCH_MIN_CHARS
      ? { name: debouncedQuery }
      : 'skip',
  )

  // Picked students live here: search results change with every keystroke.
  const [selectedStudents, setSelectedStudents] = useState<
    Partial<Record<string, SelectedStudent>>
  >({})
  // Picked student blocked because they already have a primary class this year.
  const [blockedStudent, setBlockedStudent] = useState<{
    student: SearchResult
    enrollment: Enrollment
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const formSchema = useMemo(
    () =>
      z.object({
        studentIds: z
          .array(z.custom<Id<'students'>>())
          .min(1, t('classes.enrollment.noStudentsSelected')),
        enrolledDate: z.string().min(1, t('common.required')),
        isPrimaryClass: z.boolean(),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      studentIds: [] as Array<Id<'students'>>,
      enrolledDate: new Date().toLocaleDateString('sv-SE'),
      isPrimaryClass: isPrimary,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await enrollMutation({
          studentIds: value.studentIds,
          classYearId,
          isPrimaryClass: isPrimary,
          enrolledDate: value.enrolledDate,
        })
        toast.success(t('classes.enrollment.success'))
        onOpenChange(false)
        form.reset()
        setSelectedStudents({})
      } catch (error) {
        toast.error(translateConvexError(error, t, 'classes.enrollment.error'))
      }
    },
  })

  // Handle Ctrl+Enter or Cmd+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        form.handleSubmit()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, form])

  const addStudent = (
    student: SearchResult,
    enrolledClassName: string | null,
  ) => {
    const current = form.getFieldValue('studentIds')
    if (current.includes(student._id)) return
    setSelectedStudents((prev) => ({
      ...prev,
      [student._id]: { ...student, className: enrolledClassName },
    }))
    form.setFieldValue('studentIds', [...current, student._id])
  }

  const handlePick = async (studentId: Id<'students'>) => {
    const student = results.find((s) => s._id === studentId)
    if (!student) return
    setSearchQuery('')
    setTimeout(() => {
      containerRef.current?.querySelector('input')?.focus()
    }, 50)
    try {
      const enrollment = await convex.query(
        api.students.getStudentEnrollmentForYear,
        { studentId, academicYearId },
      )
      // enrollStudents rejects a second primary class, so only that case is
      // blocked; other enrollments are added with their class shown.
      if (isPrimary && enrollment?.isPrimaryClass) {
        setBlockedStudent({ student, enrollment })
      } else {
        addStudent(student, enrollment?.className ?? null)
      }
    } catch (error) {
      toast.error(translateConvexError(error, t, 'classes.enrollment.error'))
    }
  }

  const selectedIds = form.getFieldValue('studentIds')
  const results =
    searchQuery.trim().length >= SEARCH_MIN_CHARS
      ? (searchResults ?? []).filter((s) => !selectedIds.includes(s._id))
      : []

  const comboboxItems = results.map((s) => ({
    label: formatPersonName(s.saintName, s.fullName),
    value: s._id,
  }))

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl!">
        <DialogHeader>
          <DialogTitle>
            {t('classes.enrollment.title')} - {className}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-6 max-w-full min-w-0"
        >
          <form.Field
            name="studentIds"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <div className="flex flex-col gap-4">
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>
                      {t('classes.enrollment.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <div ref={containerRef}>
                      <Combobox
                        value={null as Id<'students'> | null}
                        onValueChange={(val) => {
                          if (val) void handlePick(val)
                        }}
                        inputValue={searchQuery}
                        onInputValueChange={setSearchQuery}
                        items={comboboxItems}
                        filter={null}
                      >
                        <ComboboxInput
                          placeholder={t(
                            'classes.enrollment.searchPlaceholder',
                          )}
                          autoFocus
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            {comboboxItems.map((item) => {
                              const student = results.find(
                                (s) => s._id === item.value,
                              )
                              if (!student) return null

                              return (
                                <ComboboxItem
                                  key={item.value}
                                  value={item.value}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{item.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({t('students.col.studentCode')}:{' '}
                                      {student.studentCode})
                                    </span>
                                  </div>
                                </ComboboxItem>
                              )
                            })}
                          </ComboboxList>
                          <ComboboxEmpty>
                            {t('classes.enrollment.noStudents')}
                          </ComboboxEmpty>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>

                  {/* Selected Students Table */}
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">
                      {t(
                        'classes.enrollment.selectedList',
                        'Danh sách đã chọn',
                      )}{' '}
                      ({field.state.value.length})
                    </div>
                    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-60 bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              {t('students.col.studentCode')}
                            </TableHead>
                            <TableHead>{t('students.col.fullName')}</TableHead>
                            <TableHead>
                              {t('students.col.dateOfBirth')}
                            </TableHead>
                            <TableHead>{t('students.col.className')}</TableHead>
                            <TableHead className="w-[80px] text-right">
                              {t('common.delete')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {field.state.value.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-6 text-muted-foreground"
                              >
                                {t('classes.enrollment.noStudentsSelected')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            field.state.value.map((studentId) => {
                              const student = selectedStudents[studentId]
                              if (!student) return null
                              return (
                                <TableRow key={studentId}>
                                  <TableCell className="font-mono text-xs">
                                    {student.studentCode}
                                  </TableCell>
                                  <TableCell>
                                    {formatPersonName(
                                      student.saintName,
                                      student.fullName,
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {student.dateOfBirth
                                      ? formatDate(
                                          student.dateOfBirth.toString(),
                                        )
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {student.className ?? '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-destructive hover:bg-destructive/10"
                                      type="button"
                                      aria-label={t('common.delete')}
                                      onClick={() => {
                                        field.handleChange(
                                          field.state.value.filter(
                                            (id) => id !== studentId,
                                          ),
                                        )
                                        setSelectedStudents((prev) => {
                                          const { [studentId]: _, ...rest } =
                                            prev
                                          return rest
                                        })
                                      }}
                                    >
                                      <XIcon className="size-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )
            }}
          />

          <div>
            <form.Field
              name="enrolledDate"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="enrolled-date">
                      {t('classes.enrollment.enrolledDate')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="enrolled-date"
                      name={field.name}
                      type="date"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-4">
            <div>
              <Button
                variant="link"
                nativeButton={false}
                render={
                  <Link
                    to="/students/create"
                    search={{ enrollClassId: classYearId }}
                  />
                }
              >
                <PlusIcon />
                {t('students.create.title')}
              </Button>
            </div>
            <div>
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('classes.enrollment.submit')}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog
        open={blockedStudent !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedStudent(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('classes.enrollment.alreadyEnrolled.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedStudent &&
                t('classes.enrollment.alreadyEnrolled.description', {
                  student: formatPersonName(
                    blockedStudent.student.saintName,
                    blockedStudent.student.fullName,
                  ),
                  className: blockedStudent.enrollment.className,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockedStudent(null)}>
              {t('classes.enrollment.alreadyEnrolled.ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
