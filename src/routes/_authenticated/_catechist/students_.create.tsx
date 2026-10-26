import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { isValidPhoneNumber } from 'libphonenumber-js'
import { useForm, useSelector } from '@tanstack/react-form'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { z } from 'zod'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { StudentFormValues } from '~/components/forms/student-form'
import { translateConvexError } from '~/lib/convex-errors'

import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
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
import {
  StudentForm,
  buildAddressArgs,
  defaultStudentFormValues,
  hasAddress,
} from '~/components/forms/student-form'
import { StudentPhotoUpload } from '~/components/custom/student-photo-upload'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/create',
)({
  component: CreateStudentPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { enrollClassId?: string } => ({
    enrollClassId:
      typeof search.enrollClassId === 'string'
        ? search.enrollClassId
        : undefined,
  }),
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.create.title' },
    ],
  },
})

function CreateStudentPage() {
  const { enrollClassId } = Route.useSearch()

  return (
    <CreateStudentForm
      enrollClassId={enrollClassId as Id<'classYears'> | undefined}
    />
  )
}

function CreateStudentForm({
  enrollClassId,
}: {
  enrollClassId?: Id<'classYears'>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const createStudentWithProfile = useMutation(
    api.students.createStudentWithProfile,
  )

  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [profilePhotoStorageId, setProfilePhotoStorageId] =
    React.useState<Id<'_storage'> | null>(null)

  const formSchema = React.useMemo(
    () =>
      z.object({
        fullName: z
          .string()
          .trim()
          .min(1, t('students.form.fullName.required')),
        saintName: z.string(),
        dateOfBirth: z.string(),
        gender: z.enum(['', 'male', 'female']),
        isActive: z.boolean(),
        previousParish: z.string(),
        previousDiocese: z.string(),
        phone: z
          .string()
          .refine(
            (v) => !v || isValidPhoneNumber(v),
            t('students.form.phone.invalid'),
          ),
        email: z
          .string()
          .trim()
          .refine(
            (v) => !v || z.email().safeParse(v).success,
            t('students.form.email.invalid'),
          ),
        fullAddress: z.string(),
        addressLine1: z.string(),
        addressLine2: z.string(),
        city: z.string(),
        stateProvince: z.string(),
        postalCode: z.string(),
        hamlet: z.string(),
        subHamlet: z.string(),
        sacraments: z.any(),
        guardians: z.array(z.any()),
        enrollmentEnabled: z.boolean(),
        enrollmentClassYearId: z.string(),
        enrollmentDate: z.string(),
      }),
    [t],
  )

  const initialFormValues = React.useMemo(() => {
    const values = defaultStudentFormValues(true)
    if (enrollClassId) {
      values.enrollmentEnabled = true
      values.enrollmentClassYearId = enrollClassId
      values.enrollmentDate = new Date().toLocaleDateString('sv-SE')
    }
    return values
  }, [enrollClassId])

  const form = useForm({
    defaultValues: initialFormValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const address = hasAddress(value) ? buildAddressArgs(value) : undefined

        const sacraments = Object.entries(value.sacraments)
          .filter(([, entry]) => entry.received)
          .map(([type, entry]) => ({
            sacramentType: type as
              | 'baptism'
              | 'first_confession'
              | 'first_communion'
              | 'confirmation',
            receivedDate: entry.receivedDate || undefined,
            receivedPlace: entry.receivedPlace || undefined,
            notes: entry.notes || undefined,
          }))

        const guardians = value.guardians
          .filter(
            (g) =>
              g.phone.trim() ||
              g.email.trim() ||
              g.saintName.trim() ||
              g.fullName.trim(),
          )
          .map((g) => ({
            guardianId:
              g.isLinked && g.guardianId
                ? (g.guardianId as Id<'guardians'>)
                : undefined,
            fullName: g.fullName,
            saintName: g.saintName || undefined,
            relationship: g.relationship,
            contactPriority: g.contactPriority,
            phone: g.phone || undefined,
            email: g.email || undefined,
            notes: g.notes || undefined,
          }))

        const initialEnrollment =
          value.enrollmentEnabled && value.enrollmentClassYearId
            ? {
                classYearId: value.enrollmentClassYearId as Id<'classYears'>,
                isPrimaryClass: true,
                enrolledDate:
                  value.enrollmentDate ||
                  new Date().toLocaleDateString('sv-SE'),
              }
            : undefined

        const studentId = await createStudentWithProfile({
          student: {
            fullName: value.fullName.trim(),
            saintName: value.saintName || undefined,
            dateOfBirth: value.dateOfBirth || undefined,
            gender: value.gender || undefined,
            previousParish: value.previousParish || undefined,
            previousDiocese: value.previousDiocese || undefined,
            phone: value.phone || undefined,
            email: value.email.trim() || undefined,
            isActive: value.isActive,
            profilePhotoStorageId: profilePhotoStorageId || undefined,
          },
          address,
          sacraments: sacraments.length > 0 ? sacraments : undefined,
          guardians: guardians.length > 0 ? guardians : undefined,
          initialEnrollment,
        })

        toast.success(t('students.created'))
        setFormDirty(false)
        void navigate({ to: '/students/$id', params: { id: studentId } })
      } catch (error) {
        toast.error(translateConvexError(error, t))
      }
    },
  })

  const values = useSelector(form.store, (state) => state.values)
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)

  const handleChange = (updated: StudentFormValues) => {
    form.reset(updated, { keepDefaultValues: true })
    setFormDirty(true)
  }

  const handleCancel = () => {
    if (formDirty) setConfirmLeaveOpen(true)
    else void navigate({ to: '/students' })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserPlus}
        title={t('students.create.title')}
        subtitle={t('students.create.subtitle')}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.personal.photo')}</CardTitle>
            <CardDescription>
              {t('profile.personal.photo.maxSize')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentPhotoUpload
              fullName={
                values.saintName
                  ? `${values.saintName} ${values.fullName}`
                  : values.fullName || t('profile.personal.photo')
              }
              onPhotoChange={(storageId) => {
                setProfilePhotoStorageId(storageId)
                setFormDirty(true)
              }}
            />
          </CardContent>
        </Card>

        <StudentForm
          mode="create"
          values={values}
          onChange={handleChange}
          form={form}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('students.create.title')}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('students.confirmLeave.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('students.confirmLeave.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                void navigate({ to: '/students' })
              }}
            >
              {t('students.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
