import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, TriangleAlert } from 'lucide-react'
import type { CredentialsCsvAction, IssuedCredential } from '~/lib/export'
import { exportCredentialsCsv } from '~/lib/export'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
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
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '~/components/ui/input-group'

type Props =
  | {
      mode: 'single'
      credentials: IssuedCredential | null
      onClose: () => void
    }
  | {
      mode: 'bulk'
      credentials: Array<IssuedCredential> | null
      csvAction: CredentialsCsvAction
      onClose: () => void
    }

/**
 * Shows freshly issued plaintext credentials exactly once. Only the footer
 * button closes it (no Esc / outside click); closing before the admin copied
 * (single) or downloaded (bulk) asks for confirmation, and leaving the page
 * meanwhile triggers the browser's beforeunload prompt.
 */
export function IssuedCredentialsDialog(props: Props) {
  const { t } = useTranslation()
  const open = props.credentials !== null
  const [saved, setSaved] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) setSaved(false)
  }, [open])

  React.useEffect(() => {
    if (!open || saved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [open, saved])

  const close = () => {
    setConfirmOpen(false)
    props.onClose()
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setSaved(true)
  }

  return (
    <>
      {/* Ignore onOpenChange: Esc / outside click must not discard passwords. */}
      <Dialog open={open} disablePointerDismissal>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {props.mode === 'single'
                ? t('issuedCredentials.title.single')
                : t('issuedCredentials.title.bulk')}
            </DialogTitle>
          </DialogHeader>

          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t('issuedCredentials.warning.title')}</AlertTitle>
            <AlertDescription>
              {props.mode === 'single'
                ? t('issuedCredentials.warning.single')
                : t('issuedCredentials.warning.bulk')}
            </AlertDescription>
          </Alert>

          {props.mode === 'single' && props.credentials && (
            <div className="flex flex-col gap-4">
              <CopyField
                label={t('issuedCredentials.loginId')}
                value={props.credentials.loginId}
                onCopy={copy}
              />
              <CopyField
                label={t('issuedCredentials.password')}
                value={props.credentials.password}
                onCopy={copy}
              />
              <Button
                variant="outline"
                onClick={() => {
                  const c = props.credentials
                  if (!c) return
                  void copy(
                    `${t('issuedCredentials.loginId')}: ${c.loginId}\n${t('issuedCredentials.password')}: ${c.password}`,
                  )
                }}
              >
                <Copy />
                {t('issuedCredentials.copyBoth')}
              </Button>
            </div>
          )}

          {props.mode === 'bulk' && props.credentials && (
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                {t('issuedCredentials.count', {
                  count: props.credentials.length,
                })}
              </p>
              <Button
                onClick={() => {
                  if (!props.credentials) return
                  exportCredentialsCsv(props.credentials, props.csvAction)
                  setSaved(true)
                }}
              >
                <Download />
                {t('issuedCredentials.downloadCsv')}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => (saved ? close() : setConfirmOpen(true))}
            >
              {t('issuedCredentials.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('issuedCredentials.confirmClose.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('issuedCredentials.confirmClose.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close}>
              {t('issuedCredentials.confirmClose.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CopyField({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: (value: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await onCopy(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput readOnly value={value} className="font-mono" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={t('common.copy')}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}
