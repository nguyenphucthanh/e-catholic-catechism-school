import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { StudentFormValues } from '~/components/forms/student-form'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

import { PageHeader } from '~/components/page-header'
import { Button } from '~/components/ui/button'
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

export const Route = createFileRoute('/_authenticated/_catechist/students_/create')({
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
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  if (!canManage || !requesterId) {
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

  const [values, setValues] = React.useState<StudentFormValues>(
    defaultStudentFormValues,
  )
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleChange = (updated: StudentFormValues) => {
    setValues(updated)
    setFormDirty(true)
  }

  const handleCancel = () => {
    if (formDirty) setConfirmLeaveOpen(true)
    else void navigate({ to: '/students' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.fullName.trim()) {
      toast.error(t('students.form.fullName.required'))
      return
    }
    setIsSubmitting(true)
    try {
      // 1. Create student
      const studentId = await createStudent({
        requesterId,
        fullName: values.fullName.trim(),
        saintName: values.saintName || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        previousParish: values.previousParish || undefined,
        previousDiocese: values.previousDiocese || undefined,
        isActive: values.isActive,
      })

      // 2. Address
      if (hasAddress(values)) {
        await upsertAddress({
          requesterId,
          studentId,
          ...buildAddressArgs(values),
        })
      }

      // 3. Sacraments
      for (const [type, entry] of Object.entries(values.sacraments)) {
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
      for (const guardian of values.guardians) {
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
        values.enrollmentEnabled &&
        values.enrollmentClassYearId &&
        values.enrollmentDate
      ) {
        await enrollInClass({
          requesterId,
          studentId,
          classYearId: values.enrollmentClassYearId as Id<'classYears'>,
          enrolledDate: values.enrollmentDate,
        })
      }

      toast.success(t('students.created'))
      setFormDirty(false)
      void navigate({ to: '/students/$id', params: { id: studentId } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserPlus}
        title={t('students.create.title')}
        subtitle={t('students.create.subtitle')}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
