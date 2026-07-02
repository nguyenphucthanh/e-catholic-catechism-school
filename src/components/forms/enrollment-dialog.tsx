import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'
import { Badge } from '~/components/ui/badge'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '~/components/ui/combobox'

interface EnrollmentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  classYearId: Id<'classYears'>
  className: string
}

export function EnrollmentDialog({
  isOpen,
  onOpenChange,
  classYearId,
  className,
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

  const form = useForm({
    defaultValues: {
      studentIds: [] as Array<Id<'students'>>,
      enrolledDate: new Date().toLocaleDateString('sv-SE'),
      isPrimaryClass: true,
      tabMode: 'bulk' as 'bulk' | 'single',
    },
    onSubmit: async ({ value }) => {
      if (value.studentIds.length === 0) {
        toast.error(t('classes.enrollment.noStudentsSelected'))
        return
      }

      try {
        await enrollMutation({
          requesterId: requesterId!,
          studentIds: value.studentIds,
          classYearId,
          isPrimaryClass: value.isPrimaryClass,
          enrolledDate: value.enrolledDate,
        })
        toast.success(t('classes.enrollment.success'))
        onOpenChange(false)
        form.reset()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        toast.error(t('classes.enrollment.error', { defaultValue: message }))
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

  if (!eligibleStudents || !requesterId) return null

  const students = eligibleStudents
  const selectedIds = form.getFieldValue('studentIds')

  // Filter students for combobox (exclude already selected)
  const availableStudents = students.filter((s) => !selectedIds.includes(s._id))

  const comboboxItems = availableStudents.map((s) => ({
    label: formatPersonName(s.saintName, s.fullName),
    value: s._id,
  }))

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
          className="flex flex-col gap-4"
        >
          <Tabs
            defaultValue="bulk"
            onValueChange={(value) =>
              form.setFieldValue('tabMode', value as 'bulk' | 'single')
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk">
                {t('classes.enrollment.tabBulk')}
              </TabsTrigger>
              <TabsTrigger value="single">
                {t('classes.enrollment.tabSingle')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bulk" className="mt-4 space-y-4">
              <form.Field
                name="studentIds"
                children={(field) => (
                  <Field>
                    <FieldLabel>
                      {t('classes.enrollment.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Combobox
                      items={comboboxItems}
                      multiple
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val)}
                    >
                      <ComboboxChips>
                        {field.state.value.map((studentId) => {
                          const student = students.find(
                            (s) => s._id === studentId,
                          )
                          if (!student) return null
                          return (
                            <ComboboxChip key={studentId} showRemove>
                              {formatPersonName(
                                student.saintName,
                                student.fullName,
                              )}{' '}
                              ({student.studentCode})
                            </ComboboxChip>
                          )
                        })}
                        <ComboboxChipsInput
                          placeholder={t(
                            'classes.enrollment.searchPlaceholder',
                          )}
                          autoFocus
                        />
                      </ComboboxChips>
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
                                disabled={isEnrolled}
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span>{item.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {student.studentCode}
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
                    {field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )}
              />
            </TabsContent>

            <TabsContent value="single" className="mt-4 space-y-4">
              <form.Field
                name="studentIds"
                children={(field) => (
                  <Field>
                    <FieldLabel>
                      {t('classes.enrollment.selectStudent')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Combobox
                      items={comboboxItems}
                      value={field.state.value[0] ?? null}
                      onValueChange={(val) =>
                        field.handleChange(val ? [val] : [])
                      }
                    >
                      <ComboboxInput
                        placeholder={t('classes.enrollment.searchPlaceholder')}
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
                                disabled={isEnrolled}
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span>{item.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {student.studentCode}
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
                    {field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )}
              />
            </TabsContent>
          </Tabs>

          <form.Field
            name="enrolledDate"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="enrolled-date">
                  {t('classes.enrollment.enrolledDate')}{' '}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="enrolled-date"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />

          <form.Field
            name="isPrimaryClass"
            children={(field) => (
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-primary-class"
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <FieldLabel htmlFor="is-primary-class" className="mb-0">
                    {t('classes.enrollment.isPrimaryClass')}
                  </FieldLabel>
                </div>
              </Field>
            )}
          />

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
