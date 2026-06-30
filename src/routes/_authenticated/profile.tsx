import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from 'convex/react'
import { z } from 'zod'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import {
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserCircle,
  Users,
} from 'lucide-react'
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
import { PhoneInput } from '~/components/custom/inputs/phone-input'
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
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
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

type DialogState =
  { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; contact: Contact }

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

  const validateRequired = (val: string) => {
    const r = z.string().min(1).safeParse(val)
    return r.success ? undefined : t('common.required')
  }

  const validateValue = ({ value: val }: { value: string }) => {
    const ct = form.getFieldValue('contactType')
    if (!val) return t('common.required')
    if (ct === 'phone') {
      const phoneWithPlus = val.startsWith('+') ? val : `+${val}`
      if (!isValidPhoneNumber(phoneWithPlus))
        return t('profile.contacts.phone.invalid')
    }
    return undefined
  }

  return (
    <>
      <form
        id="contact-dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex flex-col gap-4"
      >
        <form.Field
          name="contactType"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-contactType">
                {t('profile.contacts.col.type')}
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(val) => {
                  field.handleChange(val as ContactType)
                  void form.validateField('value', 'change')
                }}
              >
                <SelectTrigger id="contact-contactType" className="w-full">
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
            </div>
          )}
        />

        <form.Field
          name="label"
          validators={{
            onBlur: ({ value }) => validateRequired(value),
            onSubmit: ({ value }) => validateRequired(value),
          }}
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-label">
                {t('profile.contacts.col.label')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-label"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder={t('profile.contacts.label.placeholder')}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        />

        <form.Field
          name="value"
          validators={{
            onChange: validateValue,
            onBlur: validateValue,
            onSubmit: validateValue,
          }}
          children={(field) => {
            const isPhone = form.getFieldValue('contactType') === 'phone'
            return (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-value">
                  {t('profile.contacts.col.value')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                {isPhone ? (
                  <PhoneInput
                    country={DEFAULT_COUNTRY.toLowerCase()}
                    disableDropdown
                    value={field.state.value}
                    onChange={(val) => {
                      field.handleChange(val)
                      void form.validateField('value', 'change')
                    }}
                    onBlur={field.handleBlur}
                    placeholder={t('profile.contacts.value.placeholder')}
                    inputProps={{
                      id: 'contact-value',
                    }}
                  />
                ) : (
                  <Input
                    id="contact-value"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      void form.validateField('value', 'change')
                    }}
                    onBlur={field.handleBlur}
                    placeholder={t('profile.contacts.value.placeholder')}
                  />
                )}
                <FieldError errors={field.state.meta.errors} />
              </div>
            )
          }}
        />

        <form.Field
          name="notes"
          children={(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-notes">
                {t('profile.contacts.col.notes')}
              </Label>
              <Input
                id="contact-notes"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        />

        <form.Field
          name="isPrimary"
          children={(field) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="contact-isPrimary"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
              />
              <Label
                htmlFor="contact-isPrimary"
                className="cursor-pointer font-normal"
              >
                {t('profile.contacts.isPrimary')}
              </Label>
            </div>
          )}
        />
      </form>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t('common.cancel')}
        </DialogClose>
        <form.Subscribe
          selector={(s) => ({ isSubmitting: s.isSubmitting })}
          children={({ isSubmitting }) => (
            <Button
              type="submit"
              form="contact-dialog-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          )}
        />
      </DialogFooter>
    </>
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
        <CardTitle>{t('profile.contacts.title')}</CardTitle>
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
                        <Pencil />
                        {t('common.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(contact)}
                      >
                        <Trash2 />
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

      {/* Add / Edit dialog */}
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

      {/* Delete confirmation */}
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
    <div className="flex flex-col gap-6">
      <PageHeader icon={UserCircle} title={t('profile.title')} />
      <PersonalInfoSection catechistId={catechistId} />
      <AddressSection catechistId={catechistId} />
      <ContactsSection catechistId={catechistId} />
    </div>
  )
}
