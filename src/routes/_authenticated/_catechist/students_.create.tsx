import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { useForm, useSelector } from '@tanstack/react-form'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { StudentFormValues } from '~/components/forms/student-form'
import { useAuth } from '~/lib/auth'
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
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.create.title' },
    ],
  },
})

function CreateStudentPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  if (!requesterId) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return <CreateStudentForm requesterId={requesterId} />
}

function CreateStudentForm({ requesterId }: { requesterId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const createStudent = useMutation(api.students.create)
  const upsertAddress = useMutation(api.students.upsertStudentAddress)
  const upsertSacrament = useMutation(api.students.upsertStudentSacrament)
  const createGuardian = useMutation(api.guardians.createGuardian)
  const addGuardianContact = useMutation(api.guardians.addGuardianContact)
  const linkGuardian = useMutation(api.guardians.linkGuardianToStudent)
  const enrollInClass = useMutation(api.students.enrollStudentInClass)

  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [profilePhotoStorageId, setProfilePhotoStorageId] =
    React.useState<Id<'_storage'> | null>(null)

  const form = useForm({
    defaultValues: defaultStudentFormValues(),
    onSubmit: async ({ value }) => {
      if (!value.fullName.trim()) {
        toast.error(t('students.form.fullName.required'))
        return
      }
      try {
        // 1. Create student
        const studentId = await createStudent({
          requesterId,
          fullName: value.fullName.trim(),
          saintName: value.saintName || undefined,
          dateOfBirth: value.dateOfBirth || undefined,
          gender: value.gender || undefined,
          previousParish: value.previousParish || undefined,
          previousDiocese: value.previousDiocese || undefined,
          isActive: value.isActive,
          profilePhotoStorageId: profilePhotoStorageId || undefined,
        })

        // 2. Address
        if (hasAddress(value)) {
          await upsertAddress({
            requesterId,
            studentId,
            ...buildAddressArgs(value),
          })
        }

        // 3. Sacraments
        for (const [type, entry] of Object.entries(value.sacraments)) {
          if (entry.received) {
            await upsertSacrament({
              requesterId,
              studentId,
              sacramentType: type as Parameters<
                typeof upsertSacrament
              >[0]['sacramentType'],
              receivedDate: entry.receivedDate || undefined,
              receivedPlace: entry.receivedPlace || undefined,
              notes: entry.notes || undefined,
            })
          }
        }

        // 4. Guardians
        for (const guardian of value.guardians) {
          let guardianId: Id<'guardians'>

          if (guardian.isLinked && guardian.guardianId) {
            guardianId = guardian.guardianId as Id<'guardians'>
          } else {
            guardianId = await createGuardian({
              requesterId,
              fullName: guardian.fullName,
              saintName: guardian.saintName || undefined,
              notes: guardian.notes || undefined,
            })
            if (guardian.phone) {
              await addGuardianContact({
                requesterId,
                guardianId,
                contactType: 'phone',
                value: guardian.phone,
                isPrimary: true,
              })
            }
            if (guardian.email) {
              await addGuardianContact({
                requesterId,
                guardianId,
                contactType: 'email',
                value: guardian.email,
                isPrimary: true,
              })
            }
          }

          await linkGuardian({
            requesterId,
            studentId,
            guardianId,
            relationship: guardian.relationship,
            contactPriority: guardian.contactPriority,
            notes: guardian.notes || undefined,
          })
        }

        // 5. Enrollment
        if (
          value.enrollmentEnabled &&
          value.enrollmentClassYearId &&
          value.enrollmentDate
        ) {
          await enrollInClass({
            requesterId,
            studentId,
            classYearId: value.enrollmentClassYearId as Id<'classYears'>,
            enrolledDate: value.enrollmentDate,
          })
        }

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
          requesterId={requesterId}
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
