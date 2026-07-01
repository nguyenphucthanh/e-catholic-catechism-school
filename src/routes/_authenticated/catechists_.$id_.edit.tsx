import * as React from 'react'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'
import { DEFAULT_COUNTRY } from '~/lib/locale'

import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import { Skeleton } from '~/components/ui/skeleton'
import { Checkbox } from '~/components/ui/checkbox'
import { Badge } from '~/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { PageHeader } from '~/components/page-header'

export const Route = createFileRoute('/_authenticated/catechists_/$id_/edit')({
  component: EditCatechistPage,
  staticData: {
    crumbs: [
      { label: 'catechists.title', path: '/catechists' },
      { label: 'catechists.edit.title' },
    ],
  },
})

type Gender = 'male' | 'female' | 'other'

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
      await updateMutation({
        requesterId,
        catechistId,
        fullName: value.fullName,
        saintName: value.saintName || undefined,
        dateOfBirth: value.dateOfBirth || undefined,
        gender: (value.gender || undefined) as Gender | undefined,
        joinedDate: value.joinedDate || undefined,
        notes: value.notes || undefined,
      })
      toast.success(t('catechists.edit.saved'))
      setFormDirty(false)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catechists.edit.personal.title')}</CardTitle>
        <CardDescription>
          {t('catechists.edit.personal.description')}
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
          <form.Field
            name="saintName"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="saintName">
                  {t('profile.personal.saintName')}
                </FieldLabel>
                <Input
                  id="saintName"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

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
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="fullName">
                  {t('profile.personal.fullName')}{' '}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="fullName"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="dateOfBirth"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="dateOfBirth">
                    {t('profile.personal.dob')}
                  </FieldLabel>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="gender"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel>{t('profile.personal.gender')}</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val as Gender | '')
                      setFormDirty(true)
                    }}
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
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />
          </div>

          <form.Field
            name="joinedDate"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="joinedDate">
                  {t('profile.personal.joinedDate')}
                </FieldLabel>
                <Input
                  id="joinedDate"
                  type="date"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

          <form.Field
            name="notes"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="notes">
                  {t('profile.personal.notes')}
                </FieldLabel>
                <Textarea
                  id="notes"
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting} className="w-fit">
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            )}
          />
        </form>
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
              <Field className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md mt-2">
                <Checkbox
                  id="isActive"
                  checked={field.state.value}
                  onCheckedChange={(checked) => {
                    field.handleChange(checked === true)
                    setFormDirty(true)
                  }}
                />
                <div className="space-y-1 leading-none">
                  <FieldLabel htmlFor="isActive">
                    {t('catechists.col.isActive')}
                  </FieldLabel>
                </div>
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
      setFormDirty(false)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('catechists.edit.address.title')}</CardTitle>
        <CardDescription>
          {t('catechists.edit.address.description')}
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
          <form.Field
            name="addressLine1"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="addressLine1">
                  {t('profile.address.line1')}
                </FieldLabel>
                <Input
                  id="addressLine1"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

          <form.Field
            name="addressLine2"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor="addressLine2">
                  {t('profile.address.line2')}
                </FieldLabel>
                <Input
                  id="addressLine2"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setFormDirty(true)
                  }}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="city"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="city">
                    {t('profile.address.city')}
                  </FieldLabel>
                  <Input
                    id="city"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />

            <form.Field
              name="postalCode"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="postalCode">
                    {t('profile.address.postal')}
                  </FieldLabel>
                  <Input
                    id="postalCode"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="hamlet"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="hamlet">
                    {t('profile.address.hamlet')}
                  </FieldLabel>
                  <Input
                    id="hamlet"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />
            <form.Field
              name="subHamlet"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor="subHamlet">
                    {t('profile.address.subHamlet')}
                  </FieldLabel>
                  <Input
                    id="subHamlet"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      setFormDirty(true)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            />
          </div>

          <form.Subscribe
            selector={(s) => ({ isSubmitting: s.isSubmitting })}
            children={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting} className="w-fit">
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            )}
          />
        </form>
      </CardContent>
    </Card>
  )
}

type ContactType = 'phone' | 'email' | 'zalo' | 'other'
type Contact = Doc<'catechistContacts'>

const CONTACT_TYPE_ICONS: Record<ContactType, React.ElementType> = {
  phone: Phone,
  email: Mail,
  zalo: MessageCircle,
  other: Users,
}

function ContactTypeIcon({ type }: { type: ContactType }) {
  const Icon = CONTACT_TYPE_ICONS[type]
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}

type DialogState =
  { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; contact: Contact }

function ContactDialogForm({
  initialValues,
  catechistId,
  onSuccess,
  addContact,
  updateContact,
}: {
  initialValues?: Contact
  catechistId: Id<'catechists'>
  onSuccess: () => void
  addContact: (args: {
    catechistId: Id<'catechists'>
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes?: string
  }) => Promise<unknown>
  updateContact: (args: {
    contactId: Id<'catechistContacts'>
    label: string
    contactType: ContactType
    value: string
    isPrimary: boolean
    notes?: string
  }) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const contactId = initialValues?._id

  const form = useForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      contactType: initialValues?.contactType ?? 'phone',
      value: initialValues?.value ?? '',
      isPrimary: initialValues?.isPrimary ?? false,
      notes: initialValues?.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      let storedValue = value.value
      if (value.contactType === 'phone') {
        const phoneWithPlus = value.value.startsWith('+')
          ? value.value
          : `+${value.value}`
        if (isValidPhoneNumber(phoneWithPlus)) {
          storedValue = parsePhoneNumber(phoneWithPlus).format('E.164')
        }
      }
      const data = {
        label: value.label,
        contactType: value.contactType,
        value: storedValue,
        isPrimary: value.isPrimary,
        notes: value.notes || undefined,
      }
      try {
        if (contactId) {
          await updateContact({ contactId, ...data })
        } else {
          await addContact({ catechistId, ...data })
        }
        onSuccess()
      } catch {
        toast.error(t('profile.contacts.saveError'))
      }
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
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field
          name="contactType"
          children={(field) => (
            <Field>
              <FieldLabel>{t('profile.contacts.col.type')}</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as ContactType)}
              >
                <SelectTrigger>
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
            </Field>
          )}
        />
        <form.Field
          name="label"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="label">
                {t('profile.contacts.col.label')}
              </FieldLabel>
              <Input
                id="label"
                placeholder={t('profile.contacts.label.placeholder')}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </Field>
          )}
        />
      </div>

      <form.Field
        name="value"
        validators={{
          onBlur: ({ value, fieldApi }) => {
            if (!value) return t('common.required')
            const type = fieldApi.form.getFieldValue('contactType')
            if (type === 'phone') {
              const phoneWithPlus = value.startsWith('+') ? value : `+${value}`
              if (!isValidPhoneNumber(phoneWithPlus)) {
                return t('profile.contacts.phone.invalid')
              }
            }
            if (type === 'email') {
              const r = z.string().email().safeParse(value)
              if (!r.success) return 'Invalid email'
            }
            return undefined
          },
        }}
        children={(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <FieldLabel htmlFor="value">
              {t('profile.contacts.col.value')}{' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="value"
              placeholder={t('profile.contacts.value.placeholder')}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              autoFocus
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError errors={field.state.meta.errors} />
            )}
          </Field>
        )}
      />

      <form.Field
        name="notes"
        children={(field) => (
          <Field>
            <FieldLabel htmlFor="notes">
              {t('profile.contacts.col.notes')}
            </FieldLabel>
            <Input
              id="notes"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </Field>
        )}
      />

      <form.Field
        name="isPrimary"
        children={(field) => (
          <Field className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
            <Checkbox
              id="isPrimary"
              checked={field.state.value}
              onCheckedChange={(checked) =>
                field.handleChange(checked === true)
              }
            />
            <div className="space-y-1 leading-none">
              <FieldLabel htmlFor="isPrimary">
                {t('profile.contacts.isPrimary')}
              </FieldLabel>
            </div>
          </Field>
        )}
      />

      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      />
    </form>
  )
}

function ContactsSection({ catechistId }: { catechistId: Id<'catechists'> }) {
  const { t } = useTranslation()
  const contacts = useQuery(api.catechists.getMyContacts, { catechistId })
  const addContactMutation = useMutation(api.catechists.addContact)
  const updateContactMutation = useMutation(api.catechists.updateContact)
  const deleteContactMutation = useMutation(api.catechists.deleteContact)

  const [dialogState, setDialogState] = React.useState<DialogState>({
    mode: 'closed',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<Contact | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const closeDialog = () => setDialogState({ mode: 'closed' })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('catechists.edit.contacts.title')}</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogState({ mode: 'add' })}
        >
          <Plus className="mr-1 size-4" />
          {t('profile.contacts.add')}
        </Button>
      </CardHeader>

      <CardContent>
        {contacts === undefined ? (
          <Skeleton className="h-20 w-full" />
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('profile.contacts.empty')}
          </p>
        ) : (
          <ul className="flex flex-col">
            {contacts.map((contact) => (
              <li
                key={contact._id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 [&:not(:first-child)]:border-t"
              >
                <ContactTypeIcon type={contact.contactType} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {contact.value}
                  </p>
                  {(contact.label || contact.notes) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[contact.label, contact.notes]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="secondary">
                    {t(`profile.contacts.type.${contact.contactType}`)}
                  </Badge>
                  {contact.isPrimary && (
                    <Badge>{t('profile.contacts.primary')}</Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t('common.moreActions')}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setDialogState({ mode: 'edit', contact })
                        }
                      >
                        <Pencil className="mr-2" />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(contact)}
                      >
                        <Trash2 className="mr-2" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={dialogState.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === 'edit'
                ? t('profile.contacts.dialog.edit')
                : t('profile.contacts.dialog.add')}
            </DialogTitle>
          </DialogHeader>
          {dialogState.mode !== 'closed' && (
            <ContactDialogForm
              key={
                dialogState.mode === 'edit' ? dialogState.contact._id : 'add'
              }
              initialValues={
                dialogState.mode === 'edit' ? dialogState.contact : undefined
              }
              catechistId={catechistId}
              addContact={addContactMutation}
              updateContact={updateContactMutation}
              onSuccess={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('profile.contacts.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.contacts.delete.description', {
                value: deleteTarget?.value ?? '',
                label: deleteTarget?.label ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (deleteTarget && !isDeleting) {
                  setIsDeleting(true)
                  try {
                    await deleteContactMutation({
                      contactId: deleteTarget._id,
                    })
                    toast.success(t('profile.contacts.deleted'))
                    setDeleteTarget(null)
                  } catch {
                    toast.error(t('profile.contacts.deleteError'))
                  } finally {
                    setIsDeleting(false)
                  }
                }
              }}
            >
              {t('profile.contacts.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
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
        actions={
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
        }
      />
      <div className="text-sm text-muted-foreground mt-[-1rem]">
        {t('catechists.edit.subtitle')}
      </div>

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
