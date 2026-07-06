import React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { UserCog } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { StudentFormValues } from '~/components/forms/student-form'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

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
  SACRAMENT_TYPES,
  StudentForm,
  buildAddressArgs,
  defaultStudentFormValues,
  hasAddress,
} from '~/components/forms/student-form'
import { StudentPhotoUpload } from '~/components/custom/student-photo-upload'

export const Route = createFileRoute(
  '/_authenticated/_catechist/students_/$id_/edit',
)({
  component: EditStudentPage,
  staticData: {
    crumbs: [
      { label: 'students.title', path: '/students' },
      { label: 'students.edit.title' },
    ],
  },
})

function EditStudentPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const canManage = isAdmin(user)
  const requesterId = user?.userDocId as Id<'catechists'> | undefined

  if (!canManage || !requesterId) {
    return (
      <div className="p-4 text-destructive flex items-center justify-center h-full">
        {t('common.contactAdmin')}
      </div>
    )
  }

  return (
    <EditStudentForm
      requesterId={requesterId}
      studentId={id as Id<'students'>}
    />
  )
}

function EditStudentForm({
  requesterId,
  studentId,
}: {
  requesterId: Id<'catechists'>
  studentId: Id<'students'>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const studentData = useQuery(api.students.getStudentDetail, {
    requesterId,
    studentId,
  })

  const guardianData = useQuery(api.students.get, {
    requesterId,
    id: studentId,
  })

  const updateStudent = useMutation(api.students.update)
  const upsertAddress = useMutation(api.students.upsertStudentAddress)
  const upsertSacrament = useMutation(api.students.upsertStudentSacrament)
  const softDeleteSacrament = useMutation(
    api.students.softDeleteStudentSacrament,
  )
  const createGuardian = useMutation(api.guardians.createGuardian)
  const addGuardianContact = useMutation(api.guardians.addGuardianContact)
  const updateGuardianContactMutation = useMutation(
    api.guardians.updateGuardianContact,
  )
  const linkGuardian = useMutation(api.guardians.linkGuardianToStudent)
  const unlinkGuardian = useMutation(api.guardians.unlinkGuardianFromStudent)
  const updateGuardianLink = useMutation(
    api.guardians.updateStudentGuardianLink,
  )

  const [values, setValues] = React.useState<StudentFormValues | null>(null)
  const [initialGuardianLinkIds, setInitialGuardianLinkIds] = React.useState<
    Map<string, Id<'studentGuardians'>>
  >(new Map())
  // Tracks existing contact IDs so we can update (not just add) phone/email on edit
  const [initialContactIds, setInitialContactIds] = React.useState<
    Map<
      string,
      { phoneId?: Id<'guardianContacts'>; emailId?: Id<'guardianContacts'> }
    >
  >(new Map())
  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Use a ref so the guard doesn't participate in re-renders or re-trigger the effect
  const initializedRef = React.useRef(false)

  // Populate form once both queries have loaded
  React.useEffect(() => {
    if (!studentData || !guardianData) return
    if (initializedRef.current) return
    initializedRef.current = true

    const sacraments: StudentFormValues['sacraments'] = {
      baptism: {
        received: false,
        receivedDate: '',
        receivedPlace: '',
        notes: '',
      },
      first_confession: {
        received: false,
        receivedDate: '',
        receivedPlace: '',
        notes: '',
      },
      first_communion: {
        received: false,
        receivedDate: '',
        receivedPlace: '',
        notes: '',
      },
      confirmation: {
        received: false,
        receivedDate: '',
        receivedPlace: '',
        notes: '',
      },
    }

    for (const s of studentData.sacraments) {
      sacraments[s.sacramentType] = {
        received: true,
        receivedDate: s.receivedDate ?? '',
        receivedPlace: s.receivedPlace ?? '',
        notes: s.notes ?? '',
      }
    }

    const linkIdMap = new Map<string, Id<'studentGuardians'>>()
    const contactIdMap = new Map<
      string,
      { phoneId?: Id<'guardianContacts'>; emailId?: Id<'guardianContacts'> }
    >()
    const guardians: StudentFormValues['guardians'] = guardianData.guardians
      .filter((g) => g.guardian !== null)
      .map((g) => {
        const localId = crypto.randomUUID()
        linkIdMap.set(localId, g._id)
        const phoneContact = g.contacts.find(
          (c) => c.contactType === 'phone' && !c.isDeleted,
        )
        const emailContact = g.contacts.find(
          (c) => c.contactType === 'email' && !c.isDeleted,
        )
        contactIdMap.set(localId, {
          phoneId: phoneContact?._id,
          emailId: emailContact?._id,
        })
        return {
          localId,
          guardianId: g.guardianId,
          fullName: g.guardian!.fullName,
          saintName: g.guardian!.saintName ?? '',
          relationship: g.relationship,
          contactPriority: g.contactPriority,
          notes: g.notes ?? '',
          phone: phoneContact?.value ?? '',
          email: emailContact?.value ?? '',
          isLinked: true,
        }
      })

    setInitialGuardianLinkIds(linkIdMap)
    setInitialContactIds(contactIdMap)

    setValues({
      ...defaultStudentFormValues(),
      fullName: studentData.fullName,
      saintName: studentData.saintName ?? '',
      dateOfBirth: studentData.dateOfBirth ?? '',
      gender: studentData.gender ?? '',
      isActive: studentData.isActive,
      previousParish: studentData.previousParish ?? '',
      previousDiocese: studentData.previousDiocese ?? '',
      addressLine1: studentData.address?.addressLine1 ?? '',
      addressLine2: studentData.address?.addressLine2 ?? '',
      city: studentData.address?.city ?? '',
      stateProvince: studentData.address?.stateProvince ?? '',
      postalCode: studentData.address?.postalCode ?? '',
      hamlet: studentData.address?.hamlet ?? '',
      subHamlet: studentData.address?.subHamlet ?? '',
      sacraments,
      guardians,
    })
  }, [studentData, guardianData])

  const handleChange = (updated: StudentFormValues) => {
    setValues(updated)
    setFormDirty(true)
  }

  const handleCancel = () => {
    if (formDirty) setConfirmLeaveOpen(true)
    else void navigate({ to: '/students/$id', params: { id: studentId } })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values) return
    if (!values.fullName.trim()) {
      toast.error(t('students.form.fullName.required'))
      return
    }
    setIsSubmitting(true)
    try {
      // 1. Update student fields
      await updateStudent({
        requesterId,
        studentId,
        fullName: values.fullName.trim(),
        saintName: values.saintName || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        isActive: values.isActive,
        previousParish: values.previousParish || undefined,
        previousDiocese: values.previousDiocese || undefined,
      })

      // 2. Address
      if (hasAddress(values)) {
        await upsertAddress({
          requesterId,
          studentId,
          ...buildAddressArgs(values),
        })
      }

      // 3. Sacraments diff
      for (const type of SACRAMENT_TYPES) {
        const entry = values.sacraments[type]
        if (entry.received) {
          await upsertSacrament({
            requesterId,
            studentId,
            sacramentType: type,
            receivedDate: entry.receivedDate || undefined,
            receivedPlace: entry.receivedPlace || undefined,
            notes: entry.notes || undefined,
          })
        } else {
          await softDeleteSacrament({
            requesterId,
            studentId,
            sacramentType: type,
          })
        }
      }

      // 4. Guardians diff
      const currentLocalIds = new Set(values.guardians.map((g) => g.localId))

      // Unlink removed guardians
      for (const [localId, linkId] of initialGuardianLinkIds.entries()) {
        if (!currentLocalIds.has(localId)) {
          await unlinkGuardian({ requesterId, linkId })
        }
      }

      // Add or update guardians
      for (const guardian of values.guardians) {
        const existingLinkId = initialGuardianLinkIds.get(guardian.localId)

        if (existingLinkId) {
          // Update link metadata
          await updateGuardianLink({
            requesterId,
            linkId: existingLinkId,
            relationship: guardian.relationship,
            contactPriority: guardian.contactPriority,
            notes: guardian.notes || undefined,
          })
          // Update contacts if phone/email changed
          const contactIds = initialContactIds.get(guardian.localId)
          const guardianId = guardian.guardianId as Id<'guardians'>
          if (guardian.phone) {
            if (contactIds?.phoneId) {
              await updateGuardianContactMutation({
                requesterId,
                contactId: contactIds.phoneId,
                contactType: 'phone',
                value: guardian.phone,
                isPrimary: true,
              })
            } else {
              await addGuardianContact({
                requesterId,
                guardianId,
                contactType: 'phone',
                value: guardian.phone,
                isPrimary: true,
              })
            }
          }
          if (guardian.email) {
            if (contactIds?.emailId) {
              await updateGuardianContactMutation({
                requesterId,
                contactId: contactIds.emailId,
                contactType: 'email',
                value: guardian.email,
                isPrimary: true,
              })
            } else {
              await addGuardianContact({
                requesterId,
                guardianId,
                contactType: 'email',
                value: guardian.email,
                isPrimary: true,
              })
            }
          }
        } else {
          // New guardian
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
      }

      toast.success(t('students.updated'))
      setFormDirty(false)
      void navigate({ to: '/students/$id', params: { id: studentId } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (studentData === undefined) {
    return (
      <div className="p-4 text-muted-foreground">{t('common.loading')}</div>
    )
  }

  if (studentData === null) {
    return <div className="p-4 text-destructive">{t('students.notFound')}</div>
  }

  if (!values) {
    return (
      <div className="p-4 text-muted-foreground">{t('common.loading')}</div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserCog}
        title={t('students.edit.title')}
        subtitle={studentData.fullName}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.personal.photo')}</CardTitle>
            <CardDescription>
              {t('profile.personal.photo.maxSize')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentPhotoUpload
              studentId={studentId}
              fullName={
                values.saintName
                  ? `${values.saintName} ${values.fullName}`
                  : values.fullName || t('profile.personal.photo')
              }
            />
          </CardContent>
        </Card>

        <StudentForm
          mode="edit"
          values={values}
          onChange={handleChange}
          requesterId={requesterId}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('common.save')}
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
                void navigate({
                  to: '/students/$id',
                  params: { id: studentId },
                })
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
