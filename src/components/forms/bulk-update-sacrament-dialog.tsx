import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
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
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { ScrollArea } from '~/components/ui/scroll-area'

type SacramentType =
  'baptism' | 'first_confession' | 'first_communion' | 'confirmation'

interface StudentRow {
  enrollment: {
    _id: Id<'studentClasses'>
    status: 'active' | 'on_leave' | 'withdrawn'
    enrolledDate: string
  }
  student: Doc<'students'> | null
}

interface BulkUpdateSacramentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  classYearId: Id<'classYears'>
  className: string
  students: Array<StudentRow>
}

export function BulkUpdateSacramentDialog({
  isOpen,
  onOpenChange,
  classYearId,
  className,
  students,
}: BulkUpdateSacramentDialogProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const appConfig = useQuery(api.appConfig.get)
  const defaultPlace = appConfig
    ? [appConfig.parishName, appConfig.dioceseName].filter(Boolean).join(', ')
    : ''

  const handleMissingRequester = () => {
    toast.error(t('common.unauthorized'))
  }

  const bulkUpdateMutation = useMutation(
    api.students.bulkUpdateStudentSacraments,
  )

  const activeStudents = students.filter(
    (s) => s.student !== null && s.enrollment.status === 'active',
  )

  const form = useForm({
    defaultValues: {
      sacramentType: '' as SacramentType | '',
      receivedDate: new Date().toLocaleDateString('sv-SE'),
      place: '',
      studentIds: [] as Array<Id<'students'>>,
    },
    onSubmit: async ({ value }) => {
      if (!requesterId) {
        handleMissingRequester()
        return
      }

      if (!value.sacramentType) {
        toast.error(t('classes.sacraments.bulkUpdate.selectSacramentRequired'))
        return
      }

      if (value.studentIds.length === 0) {
        toast.error(t('classes.sacraments.bulkUpdate.noStudentsSelected'))
        return
      }

      try {
        await bulkUpdateMutation({
          requesterId,
          classYearId,
          studentIds: value.studentIds,
          sacramentType: value.sacramentType,
          receivedDate: value.receivedDate,
          receivedPlace: value.place || undefined,
        })
        toast.success(t('classes.sacraments.bulkUpdate.success'))
        form.reset()
        onOpenChange(false)
      } catch {
        toast.error(t('classes.sacraments.bulkUpdate.error'))
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

  const sacramentItems = [
    { value: 'baptism', label: t('students.sacraments.baptism') },
    {
      value: 'first_confession',
      label: t('students.sacraments.first_confession'),
    },
    {
      value: 'first_communion',
      label: t('students.sacraments.first_communion'),
    },
    { value: 'confirmation', label: t('students.sacraments.confirmation') },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('classes.sacraments.bulkUpdate.title')} - {className}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field
              name="sacramentType"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="sacrament-type">
                    {t('classes.sacraments.bulkUpdate.selectSacrament')}{' '}
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as SacramentType)
                    }
                    items={sacramentItems}
                  >
                    <SelectTrigger id="sacrament-type" className="w-full">
                      <SelectValue
                        placeholder={t(
                          'classes.sacraments.bulkUpdate.selectSacramentPlaceholder',
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sacramentItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <form.Field
              name="receivedDate"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="received-date">
                    {t('classes.sacraments.bulkUpdate.receivedDate')}{' '}
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="received-date"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            <form.Field
              name="place"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="sacrament-place">
                    {t('students.sacraments.received_place')}
                  </FieldLabel>
                  <Input
                    id="sacrament-place"
                    placeholder={defaultPlace}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
          </div>

          <form.Field
            name="studentIds"
            children={(field) => {
              const selectedIds = field.state.value
              const toggleStudent = (id: Id<'students'>) => {
                if (selectedIds.includes(id)) {
                  field.handleChange(selectedIds.filter((x) => x !== id))
                } else {
                  field.handleChange([...selectedIds, id])
                }
              }

              const toggleAll = () => {
                if (selectedIds.length === activeStudents.length) {
                  field.handleChange([])
                } else {
                  field.handleChange(activeStudents.map((s) => s.student!._id))
                }
              }

              const isAllChecked =
                activeStudents.length > 0 &&
                selectedIds.length === activeStudents.length

              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b pb-2 mb-1">
                    <FieldLabel className="mb-0">
                      {t('classes.enrollment.selectStudents')}{' '}
                      <span className="text-destructive">*</span>
                    </FieldLabel>
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedIds.length} / {activeStudents.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-1 py-1.5 rounded-lg border bg-accent/20">
                    <Checkbox
                      id="select-all-students"
                      checked={isAllChecked}
                      onCheckedChange={toggleAll}
                    />
                    <label
                      htmlFor="select-all-students"
                      className="text-sm font-semibold cursor-pointer select-none text-foreground/90"
                    >
                      {t('classes.sacraments.bulkUpdate.selectAll')}
                    </label>
                  </div>

                  <div className="border rounded-lg overflow-hidden bg-card">
                    <ScrollArea className="h-60 p-2">
                      <div className="flex flex-col gap-1">
                        {activeStudents.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            {t('classes.enrollment.noStudents')}
                          </div>
                        ) : (
                          activeStudents.map((row) => {
                            const student = row.student!
                            const id = student._id
                            const isChecked = selectedIds.includes(id)

                            return (
                              <div
                                key={id}
                                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40 transition-colors"
                              >
                                <Checkbox
                                  id={`student-${id}`}
                                  checked={isChecked}
                                  onCheckedChange={() => toggleStudent(id)}
                                />
                                <label
                                  htmlFor={`student-${id}`}
                                  className="flex flex-col cursor-pointer select-none flex-1"
                                >
                                  <span className="text-sm font-medium text-foreground">
                                    {formatPersonName(
                                      student.saintName,
                                      student.fullName,
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {student.studentCode}
                                  </span>
                                </label>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {field.state.meta.errors.length > 0 && (
                    <FieldError
                      errors={field.state.meta.errors.map((message) => ({
                        message,
                      }))}
                    />
                  )}
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
              {t('classes.sacraments.bulkUpdate.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
