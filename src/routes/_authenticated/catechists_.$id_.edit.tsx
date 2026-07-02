import * as React from 'react'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Field, FieldContent, FieldLabel } from '~/components/ui/field'
import { Checkbox } from '~/components/ui/checkbox'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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
import { PageHeader } from '~/components/page-header'
import { CatechistPersonalInfoForm } from '~/components/forms/catechist-personal-info-form'
import { CatechistPhotoUpload } from '~/components/custom/catechist-photo-upload'
import { CatechistAddressForm } from '~/components/forms/catechist-address-form'
import { CatechistContactsSection } from '~/components/forms/catechist-contacts-section'

export const Route = createFileRoute('/_authenticated/catechists_/$id_/edit')({
  component: EditCatechistPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.edit.title' },
    ],
  },
})

function PersonalInfoSection({
  profile,
  catechistId,
  requesterId,
  setFormDirty,
}: {
  profile: Doc<'catechists'>
  catechistId: Id<'catechists'>
  requesterId: Id<'catechists'>
  setFormDirty: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const updateMutation = useMutation(api.catechists.update)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
        <CardDescription>
          {t('catechists.edit.personal.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CatechistPersonalInfoForm
          initialValues={{
            fullName: profile.fullName,
            saintName: profile.saintName ?? '',
            dateOfBirth: profile.dateOfBirth ?? '',
            gender: profile.gender ?? '',
            joinedDate: profile.joinedDate ?? '',
            notes: profile.notes ?? '',
            title: profile.title ?? '',
            community: profile.community ?? '',
            level: profile.level ?? '',
          }}
          onSubmit={async (values) => {
            await updateMutation({
              requesterId,
              catechistId,
              ...values,
            })
            toast.success(t('catechists.edit.saved'))
            setFormDirty(false)
          }}
          onDirtyChange={setFormDirty}
        />
      </CardContent>
    </Card>
  )
}

function PhotoSection({
  catechistId,
  fullName,
  setFormDirty,
}: {
  catechistId: Id<'catechists'>
  fullName: string
  setFormDirty: (dirty: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.personal.photo')}</CardTitle>
        <CardDescription>{t('profile.personal.photo.maxSize')}</CardDescription>
      </CardHeader>
      <CardContent>
        <CatechistPhotoUpload
          catechistId={catechistId}
          fullName={fullName}
          onPhotoChange={() => setFormDirty(true)}
        />
      </CardContent>
    </Card>
  )
}

function AccountSettingsSection({
  profile,
  catechistId,
  requesterId,
  setFormDirty,
}: {
  profile: Doc<'catechists'>
  catechistId: Id<'catechists'>
  requesterId: Id<'catechists'>
  setFormDirty: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const updateMutation = useMutation(api.catechists.update)

  const form = useForm({
    defaultValues: {
      role: profile.role,
      isActive: profile.isActive,
    },
    onSubmit: async ({ value }) => {
      await updateMutation({
        requesterId,
        catechistId,
        role: value.role,
        isActive: value.isActive,
      })
      toast.success(t('catechists.edit.saved'))
      setFormDirty(false)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catechists.edit.account.title')}</CardTitle>
        <CardDescription>
          {t('catechists.edit.account.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="role"
              children={(field) => (
                <Field>
                  <FieldLabel>{t('catechists.col.role')}</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val as 'admin' | 'user')
                      setFormDirty(true)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        {t('catechists.role.admin')}
                      </SelectItem>
                      <SelectItem value="user">
                        {t('catechists.role.user')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
          <form.Field
            name="isActive"
            children={(field) => (
              <Field orientation={'horizontal'}>
                <Checkbox
                  id="isActive"
                  checked={field.state.value}
                  onCheckedChange={(checked) => {
                    field.handleChange(checked === true)
                    setFormDirty(true)
                  }}
                />
                <FieldContent>
                  <FieldLabel htmlFor="isActive">
                    {t('catechists.col.isActive')}
                  </FieldLabel>
                </FieldContent>
              </Field>
            )}
          />

          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-fit"
              >
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            )}
          />
        </form>
      </CardContent>
    </Card>
  )
}

function AddressSection({
  address,
  catechistId,
  setFormDirty,
}: {
  address: Doc<'catechistAddresses'> | null
  catechistId: Id<'catechists'>
  setFormDirty: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const upsertAddress = useMutation(api.catechists.upsertMyAddress)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catechists.edit.address.title')}</CardTitle>
        <CardDescription>
          {t('catechists.edit.address.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CatechistAddressForm
          initialValues={{
            addressLine1: address?.addressLine1 ?? '',
            addressLine2: address?.addressLine2 ?? '',
            city: address?.city ?? '',
            stateProvince: address?.stateProvince ?? '',
            postalCode: address?.postalCode ?? '',
            hamlet: address?.hamlet ?? '',
            subHamlet: address?.subHamlet ?? '',
          }}
          onSubmit={async (values) => {
            await upsertAddress({ catechistId, ...values })
            toast.success(t('common.saved'))
            setFormDirty(false)
          }}
          onDirtyChange={setFormDirty}
        />
      </CardContent>
    </Card>
  )
}

function ContactsSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const contacts = useQuery(api.catechists.getMyContacts, { catechistId })
  const addContactMutation = useMutation(api.catechists.addContact)
  const updateContactMutation = useMutation(api.catechists.updateContact)
  const deleteContactMutation = useMutation(api.catechists.deleteContact)

  return (
    <CatechistContactsSection
      catechistId={catechistId}
      contacts={contacts}
      addContact={addContactMutation}
      updateContact={updateContactMutation}
      deleteContact={deleteContactMutation}
      title="catechists.edit.contacts.title"
    />
  )
}

function EditCatechistPage() {
  const { id } = useParams({ strict: false })
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const requesterId = user?.userDocId as Id<'catechists'> | undefined
  const canManage = isAdmin(user)

  const [formDirty, setFormDirty] = React.useState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = React.useState(false)

  const data = useQuery(
    api.catechists.get,
    requesterId ? { requesterId, catechistId: id as Id<'catechists'> } : 'skip',
  )

  if (!canManage || !requesterId) {
    return (
      <div className="text-destructive p-6">{t('common.contactAdmin')}</div>
    )
  }

  const handleCancel = () => {
    if (formDirty) setConfirmLeaveOpen(true)
    else navigate({ to: '/catechists/$id', params: { id: id as string } })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title={t('catechists.edit.title')}
        subtitle={t('catechists.edit.subtitle')}
        actions={
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
        }
      />

      {data === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">
          {t('catechists.notFound')}
        </p>
      ) : (
        <>
          <PersonalInfoSection
            profile={data}
            catechistId={id as Id<'catechists'>}
            requesterId={requesterId}
            setFormDirty={setFormDirty}
          />
          <PhotoSection
            catechistId={id as Id<'catechists'>}
            fullName={data.fullName}
            setFormDirty={setFormDirty}
          />
          <AccountSettingsSection
            profile={data}
            catechistId={id as Id<'catechists'>}
            requesterId={requesterId}
            setFormDirty={setFormDirty}
          />
          <AddressSection
            address={data.address}
            catechistId={id as Id<'catechists'>}
            setFormDirty={setFormDirty}
          />
          <ContactsSection catechistId={id as Id<'catechists'>} />
        </>
      )}

      <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('catechists.confirmLeave.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('catechists.confirmLeave.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeaveOpen(false)
                navigate({
                  to: '/catechists/$id',
                  params: { id: id as string },
                })
              }}
            >
              {t('catechists.confirmLeave.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
