import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { Check, Pencil, Plus, Trash2, UserCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { PageHeader } from '~/components/page-header'
import { DEFAULT_COUNTRY } from '~/lib/locale'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Textarea } from '~/components/ui/textarea'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

type ContactType = 'phone' | 'email' | 'zalo' | 'other'
type Gender = 'male' | 'female' | 'other'

function FieldError({ errors }: { errors: Array<string | undefined> }) {
  const msg = errors.find(Boolean)
  if (!msg) return null
  return <p className="text-sm text-destructive">{msg}</p>
}

// ─── Personal Info ────────────────────────────────────────────────────────────

function PersonalInfoForm({
  profile,
  catechistId,
}: {
  profile: Doc<'catechists'>
  catechistId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const updateProfile = useMutation(api.catechists.updateMyProfile)

  const form = useForm({
    defaultValues: {
      fullName: profile.fullName,
      saintName: profile.saintName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
      joinedDate: profile.joinedDate ?? '',
      notes: profile.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      await updateProfile({
        catechistId,
        fullName: value.fullName,
        saintName: value.saintName || undefined,
        dateOfBirth: value.dateOfBirth || undefined,
        gender: (value.gender || undefined) as Gender | undefined,
        joinedDate: value.joinedDate || undefined,
        notes: value.notes || undefined,
      })
      toast.success(t('common.saved'))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="fullName"
        validators={{
          onBlur: ({ value }) => {
            const r = z.string().min(1).safeParse(value)
            return r.success
              ? undefined
              : t('profile.personal.fullName.required')
          },
        }}
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">
              {t('profile.personal.fullName')}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      />

      <form.Field
        name="saintName"
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saintName">{t('profile.personal.saintName')}</Label>
            <Input
              id="saintName"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="dateOfBirth"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfBirth">{t('profile.personal.dob')}</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />

        <form.Field
          name="gender"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>{t('profile.personal.gender')}</Label>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as Gender | '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('profile.personal.gender.placeholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">
                    {t('profile.personal.gender.male')}
                  </SelectItem>
                  <SelectItem value="female">
                    {t('profile.personal.gender.female')}
                  </SelectItem>
                  <SelectItem value="other">
                    {t('profile.personal.gender.other')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      <form.Field
        name="joinedDate"
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="joinedDate">
              {t('profile.personal.joinedDate')}
            </Label>
            <Input
              id="joinedDate"
              type="date"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <form.Field
        name="notes"
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t('profile.personal.notes')}</Label>
            <Textarea
              id="notes"
              rows={3}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('profile.personal.save')}
          </Button>
        )}
      />
    </form>
  )
}

function PersonalInfoSection({
  catechistId,
}: {
  catechistId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const profile = useQuery(api.catechists.getMyProfile, { catechistId })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.personal.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {profile === undefined ? (
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">
            {t('profile.personal.not_found')}
          </p>
        ) : (
          <PersonalInfoForm profile={profile} catechistId={catechistId} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Address ──────────────────────────────────────────────────────────────────

function AddressForm({
  address,
  catechistId,
}: {
  address: Doc<'catechistAddresses'> | null
  catechistId: Id<'catechists'>
}) {
  const { t } = useTranslation()
  const upsertAddress = useMutation(api.catechists.upsertMyAddress)

  const form = useForm({
    defaultValues: {
      addressLine1: address?.addressLine1 ?? '',
      addressLine2: address?.addressLine2 ?? '',
      city: address?.city ?? '',
      stateProvince: address?.stateProvince ?? '',
      postalCode: address?.postalCode ?? '',
      hamlet: address?.hamlet ?? '',
      subHamlet: address?.subHamlet ?? '',
    },
    onSubmit: async ({ value }) => {
      await upsertAddress({
        catechistId,
        country: DEFAULT_COUNTRY,
        addressLine1: value.addressLine1 || undefined,
        addressLine2: value.addressLine2 || undefined,
        city: value.city || undefined,
        stateProvince: value.stateProvince || undefined,
        postalCode: value.postalCode || undefined,
        hamlet: value.hamlet || undefined,
        subHamlet: value.subHamlet || undefined,
      })
      toast.success(t('common.saved'))
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="addressLine1"
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressLine1">{t('profile.address.line1')}</Label>
            <Input
              id="addressLine1"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <form.Field
        name="addressLine2"
        children={(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressLine2">{t('profile.address.line2')}</Label>
            <Input
              id="addressLine2"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="city"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">{t('profile.address.city')}</Label>
              <Input
                id="city"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />

        <form.Field
          name="postalCode"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postalCode">{t('profile.address.postal')}</Label>
              <Input
                id="postalCode"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="hamlet"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hamlet">{t('profile.address.hamlet')}</Label>
              <Input
                id="hamlet"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />
        <form.Field
          name="subHamlet"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subHamlet">
                {t('profile.address.subHamlet')}
              </Label>
              <Input
                id="subHamlet"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />
      </div>

      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('profile.address.save')}
          </Button>
        )}
      />
    </form>
  )
}

function AddressSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const address = useQuery(api.catechists.getMyAddress, { catechistId })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.address.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {address === undefined ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          // address is null (no record yet) or the doc — both valid for form init
          <AddressForm address={address} catechistId={catechistId} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

type Contact = Doc<'catechistContacts'>

function ContactEditRow({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Contact
  onSave: (data: {
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes?: string
  }) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()

  const form = useForm({
    defaultValues: {
      label: initial?.label ?? '',
      contactType: initial?.contactType ?? 'phone',
      value: initial?.value ?? '',
      isPrimary: initial?.isPrimary ?? false,
      notes: initial?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      let storedValue = value.value
      if (value.contactType === 'phone' && isValidPhoneNumber(value.value)) {
        storedValue = parsePhoneNumber(value.value).format('E.164')
      }
      await onSave({
        label: value.label,
        contactType: value.contactType,
        value: storedValue,
        isPrimary: value.isPrimary,
        notes: value.notes || undefined,
      })
    },
  })

  return (
    <tr className="border-t">
      <td className="py-2 pr-2 align-top">
        <form.Field
          name="contactType"
          children={(field) => (
            <Select
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as ContactType)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">
                  {t('profile.contacts.type.phone')}
                </SelectItem>
                <SelectItem value="email">
                  {t('profile.contacts.type.email')}
                </SelectItem>
                <SelectItem value="zalo">
                  {t('profile.contacts.type.zalo')}
                </SelectItem>
                <SelectItem value="other">
                  {t('profile.contacts.type.other')}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <form.Field
          name="label"
          validators={{
            onBlur: ({ value }) => {
              const r = z.string().min(1).safeParse(value)
              return r.success ? undefined : t('common.required')
            },
          }}
          children={(field) => (
            <div>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('profile.contacts.label.placeholder')}
                className="w-28"
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <form.Field
          name="value"
          validators={{
            onBlur: ({ value: val, fieldApi }) => {
              const ct = fieldApi.form.getFieldValue('contactType')
              if (!val) return t('common.required')
              if (ct === 'phone' && !isValidPhoneNumber(val)) {
                return t('profile.contacts.phone.invalid')
              }
              return undefined
            },
          }}
          children={(field) => (
            <div>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('profile.contacts.value.placeholder')}
                className="w-40"
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        />
      </td>
      <td className="py-2 pr-2 text-center align-top pt-3">
        <form.Field
          name="isPrimary"
          children={(field) => (
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => field.handleChange(e.target.checked)}
              className="size-4"
            />
          )}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <form.Field
          name="notes"
          children={(field) => (
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={t('profile.contacts.col.notes')}
              className="w-32"
            />
          )}
        />
      </td>
      <td className="py-2 align-top">
        <form.Subscribe
          selector={(s) => ({ isSubmitting: s.isSubmitting })}
          children={({ isSubmitting }) => (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit()}
              >
                <Check className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCancel}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
        />
      </td>
    </tr>
  )
}

function ContactsSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const contacts = useQuery(api.catechists.getMyContacts, { catechistId })
  const addContact = useMutation(api.catechists.addContact)
  const updateContact = useMutation(api.catechists.updateContact)
  const deleteContact = useMutation(api.catechists.deleteContact)

  const [editingId, setEditingId] =
    React.useState<Id<'catechistContacts'> | null>(null)
  const [isAdding, setIsAdding] = React.useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('profile.contacts.title')}</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsAdding(true)
            setEditingId(null)
          }}
          disabled={isAdding}
        >
          <Plus className="mr-1 size-4" />
          {t('profile.contacts.add')}
        </Button>
      </CardHeader>
      <CardContent>
        {contacts === undefined ? (
          <Skeleton className="h-20 w-full" />
        ) : contacts.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground">
            {t('profile.contacts.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">
                    {t('profile.contacts.col.type')}
                  </th>
                  <th className="pb-2 pr-2 font-medium">
                    {t('profile.contacts.col.label')}
                  </th>
                  <th className="pb-2 pr-2 font-medium">
                    {t('profile.contacts.col.value')}
                  </th>
                  <th className="pb-2 pr-2 text-center font-medium">
                    {t('profile.contacts.col.primary')}
                  </th>
                  <th className="pb-2 pr-2 font-medium">
                    {t('profile.contacts.col.notes')}
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) =>
                  editingId === contact._id ? (
                    <ContactEditRow
                      key={contact._id}
                      initial={contact}
                      onSave={async (data) => {
                        await updateContact({ contactId: contact._id, ...data })
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={contact._id} className="border-t">
                      <td className="py-2 pr-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                          {t(`profile.contacts.type.${contact.contactType}`)}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{contact.label}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {contact.value}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {contact.isPrimary ? '●' : ''}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {contact.notes ?? ''}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(contact._id)
                              setIsAdding(false)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              deleteContact({ contactId: contact._id })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {isAdding && (
                  <ContactEditRow
                    onSave={async (data) => {
                      await addContact({ catechistId, ...data })
                      setIsAdding(false)
                    }}
                    onCancel={() => setIsAdding(false)}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const catechistId = user?.userDocId as Id<'catechists'> | undefined

  if (!catechistId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <PageHeader icon={UserCircle} title={t('profile.title')} />
        <p className="text-sm text-muted-foreground">
          {t('auth.stale_session')}{' '}
          <button
            onClick={logout}
            className="text-primary underline underline-offset-4"
          >
            {t('auth.stale_session_action')}
          </button>{' '}
          {t('auth.stale_session_suffix')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader icon={UserCircle} title={t('profile.title')} />
      <PersonalInfoSection catechistId={catechistId} />
      <AddressSection catechistId={catechistId} />
      <ContactsSection catechistId={catechistId} />
    </div>
  )
}
