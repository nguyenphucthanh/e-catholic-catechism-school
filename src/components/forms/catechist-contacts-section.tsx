import * as React from 'react'
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
import { CatechistContactDialogForm } from './catechist-contact-dialog-form'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { ContactType } from './catechist-contact-dialog-form'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
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

type Contact = Doc<'catechistContacts'>

type DialogState =
  { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; contact: Contact }

const CONTACT_TYPE_ICONS: Record<ContactType, React.ElementType> = {
  phone: Phone,
  email: Mail,
  zalo: MessageCircle,
  other: Users,
}

export function ContactTypeIcon({ type }: { type: ContactType }) {
  const Icon = CONTACT_TYPE_ICONS[type]
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}

interface CatechistContactsSectionProps {
  catechistId: Id<'catechists'>
  contacts: Array<Doc<'catechistContacts'>> | undefined
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
  deleteContact: (args: {
    contactId: Id<'catechistContacts'>
  }) => Promise<unknown>
  title?: string
}

export function CatechistContactsSection({
  catechistId,
  contacts,
  addContact,
  updateContact,
  deleteContact,
  title,
}: CatechistContactsSectionProps) {
  const { t } = useTranslation()

  const [dialogState, setDialogState] = React.useState<DialogState>({
    mode: 'closed',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<Contact | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const closeDialog = () => setDialogState({ mode: 'closed' })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title ? t(title) : t('profile.contacts.title')}</CardTitle>
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
            <CatechistContactDialogForm
              key={
                dialogState.mode === 'edit' ? dialogState.contact._id : 'add'
              }
              initialValues={
                dialogState.mode === 'edit'
                  ? {
                      label: dialogState.contact.label,
                      contactType: dialogState.contact.contactType,
                      value: dialogState.contact.value,
                      isPrimary: dialogState.contact.isPrimary,
                      notes: dialogState.contact.notes ?? '',
                    }
                  : undefined
              }
              onSubmit={async (values) => {
                if (dialogState.mode === 'edit') {
                  await updateContact({
                    contactId: dialogState.contact._id,
                    ...values,
                  })
                } else {
                  await addContact({ catechistId, ...values })
                }
                closeDialog()
              }}
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
                    await deleteContact({ contactId: deleteTarget._id })
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
