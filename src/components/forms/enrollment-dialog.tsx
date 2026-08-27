import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { translateConvexError } from '~/lib/convex-errors'
import { useSelectedAcademicYear } from '~/lib/academic-year'
import { formatPersonName } from '~/lib/name'
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
import { Badge } from '~/components/ui/badge'
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

interface EnrollmentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  classYearId: Id<'classYears'>
  className: string
  defaultStudentIds?: Array<Id<'students'>>
  isPrimary?: boolean
}

export function EnrollmentDialog({
  isOpen,
  onOpenChange,
  classYearId,
  className,
  defaultStudentIds,
  isPrimary = true,
}: EnrollmentDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedYearId } = useSelectedAcademicYear()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  const enrollMutation = useMutation(api.students.enrollStudents)

  const eligibleStudents = useQuery(
    api.students.getEligibleForEnrollment,
    requesterId && selectedYearId
      ? {
          requesterId,
          academicYearId: selectedYearId,
        }
      : 'skip',
  )

  const [searchQuery, setSearchQuery] = useState('')
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
      studentIds: defaultStudentIds ?? ([] as Array<Id<'students'>>),
      enrolledDate: new Date().toLocaleDateString('sv-SE'),
      isPrimaryClass: isPrimary,
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await enrollMutation({
          requesterId: requesterId!,
          studentIds: value.studentIds,
          classYearId,
          isPrimaryClass: isPrimary,
          enrolledDate: value.enrolledDate,
        })
        toast.success(t('classes.enrollment.success'))
        onOpenChange(false)
        form.reset()
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

  if (!eligibleStudents || !Array.isArray(eligibleStudents) || !requesterId)
    return null

  const students = eligibleStudents
  const selectedIds = form.getFieldValue('studentIds')

  // Filter students for combobox (exclude already selected, match search query)
  const availableStudents = students.filter((s) => !selectedIds.includes(s._id))

  const query = searchQuery.trim().toLowerCase()
  const filteredStudents = query
    ? availableStudents.filter((s) => {
        const label = formatPersonName(s.saintName, s.fullName).toLowerCase()
        return (
          label.includes(query) || s.studentCode.toLowerCase().includes(query)
        )
      })
    : availableStudents

  const comboboxItems = filteredStudents.map((s) => ({
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
                          if (val) {
                            field.handleChange([...field.state.value, val])
                            setSearchQuery('')
                            setTimeout(() => {
                              const input =
                                containerRef.current?.querySelector('input')
                              input?.focus()
                            }, 50)
                          }
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
                              const student = students.find(
                                (s) => s._id === item.value,
                              )
                              if (!student) return null
                              const isEnrolled =
                                student.enrolledClassYearId !== null &&
                                student.isPrimaryClass

                              return (
                                <ComboboxItem
                                  key={item.value}
                                  value={item.value}
                                >
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span>{item.label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({t('students.col.studentCode')}:{' '}
                                        {student.studentCode})
                                      </span>
                                    </div>
                                    {isEnrolled && (
                                      <Badge
                                        variant="secondary"
                                        className="w-fit"
                                      >
                                        {t('classes.enrollment.enrolledIn', {
                                          className: student.className,
                                        })}
                                      </Badge>
                                    )}
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
                              const student = students.find(
                                (s) => s._id === studentId,
                              )
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

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('classes.enrollment.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
