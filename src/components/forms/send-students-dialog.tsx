import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ArrowRightLeft, Info, Search, Send, UserPlus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatPersonName } from '~/lib/name'
import { formatDate } from '~/lib/locale'
import { translateConvexError } from '~/lib/convex-errors'
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
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'

export interface StudentRow {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

export interface SendStudentsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  currentClassYearId: Id<'classYears'>
  currentClassName: string
  students: Array<StudentRow>
}

export function SendStudentsDialog({
  isOpen,
  onOpenChange,
  currentClassYearId,
  currentClassName,
  students,
}: SendStudentsDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const appConfig = useQuery(api.appConfig.get)
  const classYears = useQuery(
    api.classes.listClassYears,
    requesterId && selectedYearId
      ? {
          requesterId,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const assignMutation = useMutation(api.students.assignStudentToClassYear)
  const [searchQuery, setSearchQuery] = useState('')

  // Available target classes (excluding current source class)
  const availableTargetClasses = useMemo(() => {
    return (classYears ?? []).filter(
      (cy) => cy.classYearId !== currentClassYearId,
    )
  }, [classYears, currentClassYearId])

  const targetClassItems = useMemo(() => {
    return availableTargetClasses.map((cy) => ({
      value: cy.classYearId,
      label: cy.className,
    }))
  }, [availableTargetClasses])

  // Active students from the current source class
  const activeStudents = useMemo(() => {
    return students.filter(
      (s) => s.student !== null && s.enrollment.status === 'active',
    )
  }, [students])

  // Sorted students based on nameFormat config
  const sortedStudents = useMemo(() => {
    const nameFormat = appConfig?.nameFormat
    return [...activeStudents].sort((a, b) => {
      const nameA = a.student!.fullName
      const nameB = b.student!.fullName

      if (nameFormat === 'firstName_lastName') {
        return nameA
          .toLocaleLowerCase()
          .localeCompare(nameB.toLocaleLowerCase())
      }

      const lastNameA = nameA.split(' ').pop() || ''
      const lastNameB = nameB.split(' ').pop() || ''

      return lastNameA
        .toLocaleLowerCase()
        .localeCompare(lastNameB.toLocaleLowerCase())
    })
  }, [activeStudents, appConfig?.nameFormat])

  // Filtered students matching search query
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sortedStudents
    return sortedStudents.filter((row) => {
      const student = row.student!
      const name = formatPersonName(
        student.saintName,
        student.fullName,
      ).toLowerCase()
      return (
        name.includes(query) ||
        student.studentCode.toLowerCase().includes(query)
      )
    })
  }, [sortedStudents, searchQuery])

  const formSchema = useMemo(
    () =>
      z.object({
        targetClassYearId: z
          .custom<Id<'classYears'> | ''>()
          .refine(
            (v): v is Id<'classYears'> => typeof v === 'string' && v !== '',
            {
              message: t('classes.sendStudents.targetClassRequired'),
            },
          ),
        studentIds: z
          .array(z.custom<Id<'students'>>())
          .min(1, t('classes.sendStudents.noStudentsSelected')),
        enrolledDate: z.string().min(1, t('common.required')),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      targetClassYearId: '' as Id<'classYears'> | '',
      studentIds: [] as Array<Id<'students'>>,
      enrolledDate: new Date().toLocaleDateString('sv-SE'),
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!requesterId) {
        toast.error(t('common.unauthorized'))
        return
      }

      const targetClass = availableTargetClasses.find(
        (c) => c.classYearId === value.targetClassYearId,
      )
      const isTargetPrimary =
        !targetClass?.classType || targetClass.classType === 'primary'

      try {
        await assignMutation({
          requesterId,
          studentIds: value.studentIds,
          targetClassYearId: value.targetClassYearId as Id<'classYears'>,
          sourceClassYearId: currentClassYearId,
          isPrimaryClass: isTargetPrimary,
          enrolledDate: value.enrolledDate,
          replaceExistingPrimary: isTargetPrimary,
        })

        if (isTargetPrimary) {
          toast.success(
            t('classes.sendStudents.successMoved', {
              count: value.studentIds.length,
              className: targetClass?.className ?? '',
            }),
          )
        } else {
          toast.success(
            t('classes.sendStudents.successEnrolled', {
              count: value.studentIds.length,
              className: targetClass.className,
            }),
          )
        }

        form.reset()
        setSearchQuery('')
        onOpenChange(false)
      } catch (error) {
        toast.error(
          translateConvexError(error, t, 'classes.sendStudents.error'),
        )
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl!">
        <DialogHeader>
          <DialogTitle>
            {t('classes.sendStudents.title')} - {currentClassName}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-6 max-w-full min-w-0"
        >
          {/* Target class selection and effective date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field
              name="targetClassYearId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="target-class">
                      {t('classes.sendStudents.targetClass')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Select
                      value={field.state.value || null}
                      onValueChange={(val) => field.handleChange(val ?? '')}
                      items={targetClassItems}
                    >
                      <SelectTrigger id="target-class" className="w-full">
                        <SelectValue
                          placeholder={t(
                            'classes.sendStudents.targetClassPlaceholder',
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {targetClassItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="enrolledDate"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor="send-date">
                      {t('classes.sendStudents.effectiveDate')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="send-date"
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

          {/* Dynamic result notice based on selected class type */}
          <form.Subscribe
            selector={(state) => state.values.targetClassYearId}
            children={(selectedTargetClassId) => {
              const selectedTargetClass = availableTargetClasses.find(
                (c) => c.classYearId === selectedTargetClassId,
              )
              const isTargetPrimary =
                !selectedTargetClass?.classType ||
                selectedTargetClass.classType === 'primary'

              if (!selectedTargetClass) {
                return (
                  <Alert className="border-muted bg-muted/40 text-muted-foreground">
                    <Info className="size-4 shrink-0" />
                    <AlertDescription>
                      {t('classes.sendStudents.selectTargetClassNotice')}
                    </AlertDescription>
                  </Alert>
                )
              }

              if (isTargetPrimary) {
                return (
                  <Alert className="border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200">
                    <ArrowRightLeft className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <AlertDescription>
                      {t('classes.sendStudents.primaryNotice')}
                    </AlertDescription>
                  </Alert>
                )
              }

              return (
                <Alert className="border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-200">
                  <UserPlus className="size-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  <AlertDescription>
                    {t('classes.sendStudents.nonPrimaryNotice')}
                  </AlertDescription>
                </Alert>
              )
            }}
          />

          {/* Student selection section */}
          <form.Field
            name="studentIds"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              const selectedIds = field.state.value

              const toggleStudent = (id: Id<'students'>) => {
                if (selectedIds.includes(id)) {
                  field.handleChange(selectedIds.filter((x) => x !== id))
                } else {
                  field.handleChange([...selectedIds, id])
                }
              }

              const isAllFilteredChecked =
                filteredStudents.length > 0 &&
                filteredStudents.every((row) =>
                  selectedIds.includes(row.student!._id),
                )

              const toggleAllFiltered = () => {
                if (isAllFilteredChecked) {
                  const filteredIds = new Set(
                    filteredStudents.map((r) => r.student!._id),
                  )
                  field.handleChange(
                    selectedIds.filter((id) => !filteredIds.has(id)),
                  )
                } else {
                  const toAdd = filteredStudents
                    .map((r) => r.student!._id)
                    .filter((id) => !selectedIds.includes(id))
                  field.handleChange([...selectedIds, ...toAdd])
                }
              }

              return (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <FieldLabel className="mb-0">
                      {t('classes.sendStudents.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <span className="text-xs text-muted-foreground font-medium">
                      {t('classes.sendStudents.selectedList')}:{' '}
                      <strong className="text-foreground">
                        {selectedIds.length}
                      </strong>{' '}
                      / {sortedStudents.length}
                    </span>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder={t('classes.sendStudents.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Table of source class students */}
                  <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-64 bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[48px] text-center">
                            <Checkbox
                              id="select-all-filtered-students"
                              checked={isAllFilteredChecked}
                              onCheckedChange={toggleAllFiltered}
                              aria-label={t('classes.sendStudents.selectAll')}
                            />
                          </TableHead>
                          <TableHead className="w-[100px]">
                            {t('students.col.studentCode')}
                          </TableHead>
                          <TableHead>{t('students.col.fullName')}</TableHead>
                          <TableHead>{t('students.col.dateOfBirth')}</TableHead>
                          <TableHead className="w-[90px] text-right">
                            {t('students.col.status')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedStudents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-6 text-muted-foreground"
                            >
                              {t('classes.sendStudents.noStudentsInClass')}
                            </TableCell>
                          </TableRow>
                        ) : filteredStudents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-6 text-muted-foreground"
                            >
                              {t('classes.enrollment.noStudents')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredStudents.map((row) => {
                            const student = row.student!
                            const isChecked = selectedIds.includes(student._id)
                            return (
                              <TableRow
                                key={student._id}
                                className="cursor-pointer"
                                onClick={() => toggleStudent(student._id)}
                              >
                                <TableCell
                                  className="text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    id={`student-check-${student._id}`}
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      toggleStudent(student._id)
                                    }
                                    aria-label={formatPersonName(
                                      student.saintName,
                                      student.fullName,
                                    )}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs font-medium">
                                  {student.studentCode}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatPersonName(
                                    student.saintName,
                                    student.fullName,
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {student.dateOfBirth
                                    ? formatDate(student.dateOfBirth.toString())
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="default" className="text-xs">
                                    {t(
                                      `students.status.${row.enrollment.status}`,
                                      {
                                        defaultValue: row.enrollment.status,
                                      },
                                    )}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </div>
              )
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              <Send className="size-4" />
              {t('classes.sendStudents.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
